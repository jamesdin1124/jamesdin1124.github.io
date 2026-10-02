/* 夜尿症衛教引擎 — 由 pediatric-enuresis-education/modules/education_engine.py 移植
   醫學內容原文保留。純前端，無網路請求，無儲存。 */

const expectedBladderCapacityMl = a => (a + 1) * 30;      // ICCS: (age+1)×30
const recommendedDailyFluidMl   = w => w * 35;            // Holliday-Segar 簡化

function screenRomeIV(c){                                  // ≥2 項為陽性
  return [c.stool_freq_le_2, c.hard_or_painful, c.retentive_posturing,
          c.fecal_incontinence, c.large_diameter_stool].filter(Boolean).length >= 2;
}

function generateRecommendations(mh, vs, ct){
  const age = mh.age_years ?? 7, weight = mh.weight_kg;
  const sections = [];
  const flags = { alarm_therapy_candidate:false, desmopressin_candidate:false,
    needs_specialist_referral:false, constipation_detected:false, small_bladder_detected:false,
    nocturnal_polyuria_detected:false, sleep_breathing_concern:false, bbd_detected:false,
    referral_reasons:[] };

  /* 1. 膀胱容量分析 */
  const expectedBc = expectedBladderCapacityMl(age);
  const maxVoided = vs.max_voided_volume_ml || 0;
  const bcRatio = (expectedBc > 0 && maxVoided > 0) ? maxVoided / expectedBc * 100 : 0;
  let bc = `預期膀胱容量（ICCS 公式）：**${expectedBc} ml**\n\n`;
  bc += `您孩子的最大排尿量：**${maxVoided} ml**（${bcRatio.toFixed(0)}%）\n\n`;
  if (bcRatio < 65){
    bc += "最大排尿量低於預期的 65%，代表**膀胱容量偏小**（膀胱能裝的尿液量比同齡孩子少）。\n\n"
       +  "建議：\n- 白天定時排尿（每 2-3 小時）\n- 練習延長憋尿時間（逐步增加）\n"
       +  "- 睡前雙重排尿（排尿後等幾分鐘再排一次）\n";
    flags.small_bladder_detected = true;
  } else if (bcRatio > 150){
    bc += "最大排尿量高於預期的 150%，代表**夜間尿液產生過多**。\n\n建議進一步評估夜間尿量。\n";
    flags.nocturnal_polyuria_detected = true;
  } else { bc += "膀胱容量在正常範圍內。\n"; }
  sections.push({ title:"膀胱容量分析", icon:"🔬", content:bc,
    severity:(bcRatio<65||bcRatio>150)?"warning":"success" });

  /* 2. 液體管理 */
  const totalIntake = vs.total_intake_ml || 0, diaryDays = vs.total_nights || 2;
  const avgDaily = diaryDays > 0 ? totalIntake / diaryDays : 0;
  let fl = "";
  if (weight > 0){
    fl += `建議每日液體攝取量：約 **${recommendedDailyFluidMl(weight).toFixed(0)} ml**（體重 × 35 ml/kg）\n\n`;
    if (avgDaily > 0){
      fl += `您記錄的平均每日攝取量：**${avgDaily.toFixed(0)} ml**\n\n`;
      if (avgDaily < recommendedDailyFluidMl(weight) * 0.7) fl += "攝取量偏低，建議白天多喝水。\n\n";
    }
  } else { fl += "未記錄體重，無法計算建議攝取量。\n\n"; }
  fl += "**液體攝取時間建議：**\n- 早上和中午多喝水（佔每日 60-70%）\n- 下午適量飲水\n"
     +  "- 晚餐後限制液體攝取\n- 睡前 2 小時盡量避免大量飲水\n"
     +  "- 避免含咖啡因飲料（茶、可樂、巧克力飲品）\n\n"
     +  "**晚餐注意事項：**\n- 晚餐避免口味過重、醬料過多的食物\n"
     +  "- 避免太晚吃晚餐（建議至少睡前 3 小時前吃完）\n"
     +  "- 減少高蛋白質、高電解質的食物（如火鍋、拉麵、滷味等）\n"
     +  "- 這些食物會讓身體需要更多水分來代謝，增加夜間尿量\n";
  sections.push({ title:"液體與飲食管理建議", icon:"💧", content:fl, severity:"info" });

  /* 3. 便秘處理 */
  const constipation = !!mh.constipation_screening_positive;
  if (constipation){
    flags.constipation_detected = true;
    sections.push({ title:"便秘處理", icon:"💩", severity:"warning", content:
      "排便評估結果：**孩子可能有便秘**\n\n"
     +"便秘是尿床的重要相關因素。肚子裡堆積的糞便會壓迫到膀胱，讓膀胱能裝的尿液量變少。\n\n"
     +"**建議：**\n"
     +`- 每日膳食纖維：**${age + 5} 公克**（年齡 + 5）\n`
     +"- 多攝取蔬菜、水果、全穀類\n- 充足的水分攝取\n"
     +"- 建立固定排便習慣（飯後 20-30 分鐘坐馬桶）\n- 排便姿勢：腳踏凳，膝蓋高於髖部\n"
     +"- 若飲食調整無效，請諮詢醫師是否需要藥物治療\n" });
  }

  /* 3b. 日間排尿症狀 */
  const dU=!!mh.daytime_urgency, dF=!!mh.daytime_frequency, dI=!!mh.daytime_incontinence,
        hM=!!mh.holding_maneuvers, sV=!!mh.straining_to_void, wS=!!mh.weak_stream;
  if (dU||dF||dI||hM||sV||wS){
    let c = "孩子有以下白天排尿症狀，需要特別注意：\n\n";
    if (dU) c += "**急尿（尿急）：**\n- 突然很急、覺得快要尿出來，可能是膀胱過度敏感\n"
               + "- 白天定時排尿（每 2-3 小時），不要等到很急才去\n"
               + "- 練習放鬆：感覺尿急時，先停下來深呼吸，用力夾緊再慢慢放鬆，等尿急感過去再走去廁所\n\n";
    if (dF) c += "**頻尿（白天排尿超過 8 次）：**\n- 頻尿可能與膀胱容量小、水分攝取過多或膀胱過動有關\n"
               + "- 記錄每次排尿量，觀察是否每次都只有一點點\n- 試著逐步延長排尿間隔，訓練膀胱容量\n\n";
    if (dI) c += "**白天漏尿：**\n- 白天會不小心漏尿，建議進一步評估膀胱功能\n"
               + "- 定時排尿是最重要的第一步\n- 若合併便秘，需先改善排便\n"
               + "- 建議至小兒腎臟科或泌尿科做完整評估\n\n";
    if (hM) c += "**憋尿動作（夾腿、蹲下、扭動身體）：**\n- 這些動作代表孩子在忍尿，常見於膀胱過動的孩子\n"
               + "- 忍尿反而會讓膀胱問題更嚴重\n- 提醒孩子感覺想尿時就去上廁所，不要忍\n\n";
    if (sV) c += "**排尿用力：**\n- 尿尿時需要用力才尿得出來，可能代表排尿出口有阻力\n"
               + "- 建議做**尿流速檢查（UFM）**評估排尿功能\n- 排尿時應該放鬆，不需要用力\n\n";
    if (wS) c += "**尿柱細弱：**\n- 尿尿的水柱很細、很弱，可能與排尿出口問題有關\n"
               + "- 建議做**尿流速檢查（UFM）**和超音波檢查\n- 排尿後檢查膀胱是否有殘尿\n\n";
    sections.push({ title:"日間排尿症狀評估", icon:"🚿", content:c,
      severity:(sV||wS||dI)?"error":"warning" });
  }

  /* 3c. 排便症狀（未達便秘標準） */
  const hp=!!mh.hard_or_painful, rp=!!mh.retentive_posturing, fi=!!mh.fecal_incontinence,
        ld=!!mh.large_diameter_stool, sf = mh.stool_frequency_per_week ?? 7;
  if ((hp||rp||fi||ld||sf<=2) && !constipation){
    let c = "孩子有以下排便相關症狀，雖然尚未達到便秘的診斷標準，仍需注意：\n\n";
    if (sf<=2) c += "**排便次數偏少（每週 ≤ 2 次）：**\n- 正常兒童應每天或至少隔天排便一次\n"
                  + "- 排便次數過少可能是便秘的早期徵兆\n- 增加膳食纖維和水分攝取\n\n";
    if (hp) c += "**大便很硬或排便會痛：**\n- 硬便和疼痛會讓孩子害怕上廁所，形成惡性循環\n"
               + "- 增加水分和纖維攝取，讓大便變軟\n- 如果持續硬便，可諮詢醫師是否需要軟便劑\n\n";
    if (rp) c += "**忍便行為（夾腿、坐立不安）：**\n- 孩子故意忍著不大便，可能因為怕痛或不喜歡上廁所\n"
               + "- 忍便會讓糞便越積越硬，越來越難排出\n- 建立固定排便時間，飯後 20-30 分鐘坐馬桶\n\n";
    if (fi) c += "**滲便（便便不小心漏出來）：**\n- 滲便常見於嚴重便秘的孩子，積在腸子裡的硬便周圍會有軟便滲出\n"
               + "- 這不是孩子故意的，不要責備\n- 需要先處理便秘問題，滲便才會改善\n"
               + "- 建議就醫評估是否需要藥物協助\n\n";
    if (ld) c += "**大便很大條（差點塞住馬桶）：**\n- 這代表糞便在腸子裡停留太久，水分被吸收後變得又大又硬\n"
               + "- 增加排便頻率，不要讓糞便積太久\n\n";
    sections.push({ title:"排便症狀提醒", icon:"📋", content:c, severity:"info" });
  }

  /* 4a. 解尿習慣 */
  sections.push({ title:"解尿習慣與姿勢建議", icon:"🚽", severity:"info", content:
    "良好的排尿習慣對改善尿床很重要。\n\n"
   +"**定時排尿：**\n- 白天每 **2-3 小時**上一次廁所，不要等到很急才去\n"
   +"- 在學校下課時間也要記得去上廁所\n- 睡前一定要上廁所\n\n"
   +"**正確的排尿姿勢：**\n- 坐在馬桶上時，腳底要踩到地面或踩在**腳踏凳**上（腳不能懸空）\n"
   +"- 身體放鬆，不要憋氣或用力擠壓\n- 對較小的孩子，可以使用兒童馬桶座或加裝馬桶輔助座\n"
   +"- 男孩**坐著尿**可以更放鬆、排得更乾淨\n\n"
   +"**排尿時注意：**\n- 不要急著站起來，尿完後等幾秒確認是否還有\n"
   +"- 每次上廁所時間不要太趕，至少坐 **1-2 分鐘**\n"
   +"- 睡前可練習**雙重排尿**：排尿後等 1-2 分鐘再排一次，把膀胱裡殘留的尿排乾淨\n" });

  /* 4b. 解便習慣 */
  sections.push({ title:"解便習慣與姿勢建議", icon:"💩", severity:"info", content:
    "良好的排便習慣不僅改善便秘，也有助於改善膀胱功能和尿床。\n\n"
   +"**建立固定排便時間：**\n- 每天在**固定的時間**坐馬桶，養成排便習慣\n"
   +"- 最佳時機是**飯後 20-30 分鐘**（這時候腸子會自然蠕動，叫做「胃結腸反射」）\n"
   +"- 建議每天至少選 1-2 個飯後時段坐馬桶（例如早餐後和晚餐後）\n"
   +"- 每次坐馬桶至少 **3-5 分鐘**，不要催促孩子\n"
   +"- 即使沒有便意，也要坐一坐，培養身體的排便節律\n\n"
   +"**正確的排便姿勢：**\n- 腳底要踩在**腳踏凳**上（腳不能懸空）\n"
   +"- 膝蓋的位置要**略高於臀部**，呈現微微前傾的姿勢\n"
   +"- 這個姿勢可以讓骨盆底肌肉放鬆，排便更順暢\n"
   +"- 雙手可以放在大腿上或自然垂放，身體放鬆\n"
   +"- **不要用力憋氣或出力擠壓**，慢慢來就好\n\n"
   +"**排便時注意：**\n- 有便意時**不要忍便**，馬上去上廁所\n"
   +"- 忍便會讓糞便在腸子裡越積越硬，越來越難排出\n"
   +"- 可以在廁所放一本書或小玩具，讓孩子願意坐久一點\n"
   +"- 排便後記得擦乾淨，養成好的衛生習慣\n" });

  /* 5. BBD */
  const dSx = dU||dI||dF||hM;
  if (constipation && dSx){
    flags.bbd_detected = true;
    sections.push({ title:"膀胱與排便功能障礙（BBD）", icon:"⚠️", severity:"warning", content:
      "**孩子同時有排便問題和白天膀胱症狀**，這種情形叫做「膀胱與排便功能障礙（BBD）」。\n\n"
     +"排便問題和膀胱問題常常互相影響：\n"
     +"- 便秘時堆積在腸子裡的糞便會壓迫膀胱，讓膀胱裝不了那麼多尿\n"
     +"- 忍便的習慣也常常伴隨忍尿的習慣\n- 兩個問題需要**一起處理**，效果才會好\n\n"
     +"**BBD 的處理原則：**\n\n"
     +"⚠️ **第一步：先處理便秘**\n- 便秘如果沒有先改善，光治療膀胱問題效果通常不好\n"
     +"- 請先參考上方「便秘處理」的建議\n- 排便正常後，很多膀胱症狀會跟著改善\n\n"
     +"**第二步：同時建立良好如廁習慣**\n"
     +"- 定時上廁所（不論大小便）：每 2-3 小時排尿，飯後坐馬桶排便\n"
     +"- 正確坐姿：腳踩腳踏凳、膝蓋高於臀部、身體放鬆\n- 不要忍尿也不要忍便\n"
     +"- 每次坐馬桶時間足夠（3-5 分鐘），不要催促\n\n"
     +"**第三步：追蹤記錄**\n- 建議排便紀錄持續記錄 **2 週**，觀察排便是否有改善\n"
     +"- 同時記錄白天的漏尿、急尿情形是否減少\n"
     +"- 如果便秘改善後膀胱症狀仍持續，建議就醫做進一步評估\n" });
  } else if (dSx && !constipation){
    sections.push({ title:"排便與膀胱功能提醒", icon:"📋", severity:"info", content:
      "孩子有白天的膀胱症狀（如急尿、頻尿或漏尿），建議同時注意**排便是否正常**。\n\n"
     +"排便和排尿的問題經常一起出現。即使目前篩檢沒有發現便秘，仍建議：\n"
     +"- 持續記錄排便狀況至少 **2 週**\n"
     +"- 注意是否有忍便、大便很硬、排便不規律等情形\n"
     +"- 如果排便不正常，要和膀胱問題一起處理，效果才會好\n" });
  }

  /* 6. 睡眠與過敏 */
  const snoring = mh.snoring || "無", osa=!!mh.osa_diagnosed,
        adenoid=!!mh.adenoid_hypertrophy, tonsillar=!!mh.tonsillar_hypertrophy,
        allergic=!!mh.allergic_rhinitis;
  if (snoring !== "無" || osa || adenoid || tonsillar){
    flags.sleep_breathing_concern = true;
    let c = "**睡眠呼吸問題與尿床有顯著關聯。**\n\n";
    if (osa) c += "孩子曾被診斷有睡眠呼吸中止。治療之後，約 60-75% 的兒童尿床會改善。\n\n";
    if (snoring === "經常") c += "經常打呼可能代表上呼吸道有阻塞。\n\n";
    if (adenoid || tonsillar) c += "腺樣體或扁桃腺肥大可能影響睡眠品質。\n\n";
    if (allergic) c += "過敏性鼻炎可能加重鼻塞和打呼。\n\n";
    c += "**建議：**\n- 建議至耳鼻喉科評估上呼吸道\n"
      +  "- 若有睡眠呼吸中止，優先治療（可能改善尿床）\n"
      +  "- 過敏性鼻炎：鼻用類固醇噴劑可改善鼻塞\n";
    sections.push({ title:"睡眠與過敏評估", icon:"😴", content:c, severity:"warning" });
  }

  /* 7. 治療候選（僅 flags，不顯示） */
  const freq = mh.bedwetting_frequency || "", bwType = mh.bedwetting_type || "從小就有";
  if (age >= 6 && !(dU||dI||dF) && ["每晚","每週4-6次","每週2-3次"].includes(freq))
    flags.alarm_therapy_candidate = true;
  if (flags.nocturnal_polyuria_detected && !flags.small_bladder_detected)
    flags.desmopressin_candidate = true;

  /* 8. 轉介 */
  const oc = mh.other_conditions || [], r = [];
  if (bwType === "曾經好過又復發") r.push("尿床曾經好過又復發，需要進一步檢查原因");
  if (sV || wS) r.push("排尿困難（需要用力或尿柱很弱），建議做尿流速檢查");
  if (oc.includes("曾經有尿道或膀胱感染")) r.push("曾有尿道或膀胱感染，需進一步評估");
  if (oc.includes("脊椎相關疾病（如脊柱裂等）")) r.push("有脊椎相關疾病，需排除神經性膀胱");
  if ((dU||dI||dF) && ["每晚","每週4-6次"].includes(freq)) r.push("白天和晚上都有明顯症狀，建議做完整的泌尿評估");
  if (age > 10 && ["每晚","每週4-6次"].includes(freq)) r.push("年齡 > 10 歲且頻率高，建議專科評估");
  if (r.length){
    flags.needs_specialist_referral = true; flags.referral_reasons = r;
    sections.push({ title:"專科轉介建議", icon:"🏥", severity:"error",
      content:"**建議至小兒腎臟科或小兒泌尿科就診：**\n\n" + r.map(x=>`- ${x}\n`).join("") });
  }

  /* 9. 臨床檢查 */
  if (ct){
    let c = "";
    if (ct.uosm) c += ct.uosm < 800
      ? `晨尿滲透壓：${ct.uosm} mOsm/kg（偏低，代表腎臟濃縮尿液的功能不夠，所以夜間尿量會偏多）\n`
      : `晨尿滲透壓：${ct.uosm} mOsm/kg（正常）\n`;
    if (ct.ufm_flow_pattern && ct.ufm_flow_pattern !== "鐘型（正常）")
      c += `尿流型態：${ct.ufm_flow_pattern}（異常，建議進一步評估）\n`;
    if (ct.renal_us_post_void_residual_ml > 20)
      c += `排尿後膀胱裡還剩 ${ct.renal_us_post_void_residual_ml} ml 的尿沒排乾淨（偏多）\n`;
    if (c) sections.push({ title:"臨床檢查結果判讀", icon:"🔎", content:c, severity:"info" });
  }

  /* 10. 行為建議 */
  let bh = "**基本行為治療建議：**\n\n"
    +"1. **正向鼓勵**：不要因為尿床處罰孩子，這不是他們的錯\n"
    +"2. **睡前排尿**：養成睡前上廁所的習慣\n"
    +"3. **適當的飲水時間分配**：白天多喝，晚上少喝\n"
    +"4. **避免睡前含糖/含咖啡因飲料**\n"
    +"5. **晚餐清淡**：避免太鹹、太多醬料、高蛋白的食物\n"
    +"6. **記錄日記**：持續記錄可幫助評估治療效果\n"
    +"7. **耐心**：大多數兒童會隨年齡自然改善\n";
  if (["有時會","每晚都會"].includes(mh.night_waking))
    bh += "\n**關於夜間叫孩子起床尿尿：**\n"
       +  "您目前有在晚上叫孩子起來上廁所。如果這個做法已經持續一段時間，但尿床情形**沒有明顯改善**，建議您可以**停止叫醒**。\n\n"
       +  "原因：\n- 叫醒孩子並不能訓練膀胱功能或改善夜間尿液調節\n- 反而可能影響孩子的睡眠品質\n"
       +  "- 若孩子叫不醒或叫醒後仍無法自己尿尿，效果更有限\n- 建議改為其他更有效的行為治療方式\n";
  if (mh.father_had_bedwetting || mh.mother_had_bedwetting){
    bh += "\n**家族史提示：**\n父母有尿床史時，孩子約有 40-77% 的機率也會有尿床的情形。\n"
       +  "這通常是遺傳因素，會隨年齡自然改善。\n";
    if (mh.family_resolution_age > 0)
      bh += `您的家人約在 ${mh.family_resolution_age} 歲好的，孩子可能也會在類似年齡改善。\n`;
  }
  sections.push({ title:"行為治療與生活建議", icon:"🌟", content:bh, severity:"info" });

  return { summary:{
      expected_bladder_capacity_ml: expectedBc,
      max_voided_volume_ml: maxVoided,
      bladder_capacity_ratio: Math.round(bcRatio*10)/10,
      avg_daily_intake_ml: Math.round(avgDaily),
      wet_nights: vs.wet_nights || 0, total_nights: vs.total_nights || 0
    }, sections, flags };
}

/* 同時支援 <script> 與 Node 測試 */
if (typeof window !== 'undefined') {
  window.EnuresisEngine = { generateRecommendations, screenRomeIV, expectedBladderCapacityMl, recommendedDailyFluidMl };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateRecommendations, screenRomeIV, expectedBladderCapacityMl, recommendedDailyFluidMl };
}
