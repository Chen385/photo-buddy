/*
 * 免版权曲库：所有曲目均由浏览器内置音源（Web Audio）实时合成，
 * 不含任何受版权保护的现成歌曲。每首片段时长 15 秒。
 *
 * moods: 适配的情绪标签
 * modes: 适配的配文模式  decide=帮我决定 / serious=认真配 / fun=放开整活
 * synth: 编曲参数（供 audio-engine 使用）
 */
window.TRACKS = [
  {
    id: "weekend-pop",
    title: "周末出逃",
    sub: "轻快律动 · 15 秒片段",
    moods: ["happy", "energetic", "sunny"],
    modes: ["decide", "serious", "fun"],
    synth: {
      bpm: 108, root: 60, mode: "major", intensity: 0.85,
      bassWave: "triangle", leadWave: "square", hats: true, kick: true,
      melody: [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 2]
    },
    reason: "节奏明快、鼓点轻盈，和照片里那种放松又开心的氛围很搭，像周末出门吹风的第一口空气。"
  },
  {
    id: "soft-heal",
    title: "温柔治愈",
    sub: "软垫氛围 · 15 秒片段",
    moods: ["soft", "calm", "chill"],
    modes: ["decide", "serious"],
    synth: {
      bpm: 72, root: 57, mode: "major", intensity: 0.5,
      bassWave: "sine", leadWave: "sine", hats: false, kick: false,
      melody: [0, 4, 7, 4, 2, 0, 4, 2, 5, 4, 2, 0, 7, 4, 2, 0]
    },
    reason: "音色柔软、和弦温暖，适合安安静静记录当下，像把这一刻的松弛感轻轻裹进旋律里。"
  },
  {
    id: "sunset-glow",
    title: "落日漫街",
    sub: "慵懒暮色 · 15 秒片段",
    moods: ["sunset", "chill", "soft"],
    modes: ["decide", "serious"],
    synth: {
      bpm: 84, root: 59, mode: "major", intensity: 0.6,
      bassWave: "triangle", leadWave: "triangle", hats: true, kick: false,
      melody: [0, 2, 4, 7, 5, 4, 2, 4, 2, 0, 4, 5, 7, 5, 4, 2]
    },
    reason: "速度放慢、音色偏暖，很有傍晚散步和逆光剪影的画面感，适合留给夕阳和收尾镜头。"
  },
  {
    id: "city-cool",
    title: "酷飒街拍",
    sub: "城市律动 · 15 秒片段",
    moods: ["cool", "energetic"],
    modes: ["decide", "serious"],
    synth: {
      bpm: 96, root: 55, mode: "minor", intensity: 0.8,
      bassWave: "sawtooth", leadWave: "square", hats: true, kick: true,
      melody: [0, 0, 3, 5, 3, 0, 2, 3, 5, 3, 0, 3, 2, 0, 3, 5]
    },
    reason: "低频扎实、节拍利落，带一点街头酷感，适合街拍、穿搭和走路带风的画面。"
  },
  {
    id: "cute-daily",
    title: "可爱日常",
    sub: "俏皮小跳 · 15 秒片段",
    moods: ["cute", "happy"],
    modes: ["decide", "serious", "fun"],
    synth: {
      bpm: 100, root: 62, mode: "major", intensity: 0.7,
      bassWave: "triangle", leadWave: "sine", hats: true, kick: true,
      melody: [0, 4, 7, 4, 0, 4, 7, 9, 7, 4, 2, 4, 0, 2, 4, 0]
    },
    reason: "旋律跳跳的、音色甜甜，很适配小动物、美食和可爱细节，听着就想跟着晃一下。"
  },
  {
    id: "funny-groove",
    title: "整活进行曲",
    sub: "搞怪放克 · 15 秒片段",
    moods: ["playful", "funny", "happy"],
    modes: ["decide", "fun"],
    synth: {
      bpm: 112, root: 58, mode: "major", intensity: 0.9,
      bassWave: "sawtooth", leadWave: "square", hats: true, kick: true,
      melody: [0, 4, 0, 7, 5, 4, 2, 4, 0, 7, 5, 4, 2, 0, 4, 7]
    },
    reason: "放克贝斯带点小调皮，节拍灵活有梗，整活、表情包和反转镜头配它最容易出效果。"
  },
  {
    id: "quiet-mind",
    title: "安静独白",
    sub: "极简钢琴 · 15 秒片段",
    moods: ["calm", "soft"],
    modes: ["serious"],
    synth: {
      bpm: 66, root: 55, mode: "minor", intensity: 0.45,
      bassWave: "sine", leadWave: "sine", hats: false, kick: false,
      melody: [0, 3, 7, 3, 5, 3, 0, -2, 3, 5, 3, 0, 7, 3, 5, 3]
    },
    reason: "织体极简、留白很多，适合想认真说点心里话的照片，情绪收着放，不抢画面。"
  },
  {
    id: "ocean-breeze",
    title: "海风轻拂",
    sub: "舒缓自然 · 15 秒片段",
    moods: ["chill", "sunset", "soft"],
    modes: ["decide", "serious"],
    synth: {
      bpm: 78, root: 60, mode: "major", intensity: 0.55,
      bassWave: "sine", leadWave: "triangle", hats: false, kick: false,
      melody: [0, 2, 4, 2, 7, 5, 4, 2, 5, 4, 2, 4, 2, 0, 2, 4]
    },
    reason: "波浪式的起伏和松弛速度，很适配海边、植物和放空时刻，听感像一阵慢慢吹过来的风。"
  }
];

/* 关键词 → 情绪标签映射（供本地规则兜底使用） */
window.KEYWORD_MOODS = [
  { words: ["朋友", "聚会", "开心", "笑", "干杯", "奶茶", "咖啡", "生日"], moods: ["happy", "energetic"] },
  { words: ["日落", "夕阳", "黄昏", "晚霞", "海边", "沙滩", "浪花"], moods: ["sunset", "chill"] },
  { words: ["猫", "狗", "宠物", "可爱", "萌", "玩偶", "蛋糕", "甜品"], moods: ["cute", "happy"] },
  { words: ["城市", "街拍", "穿搭", "地铁", "夜景", "商场", "街头"], moods: ["cool", "energetic"] },
  { words: ["治愈", "安静", "独处", "读书", "茶", "窗", "雨"], moods: ["soft", "calm"] },
  { words: ["搞笑", "梗", "沙雕", "翻车", "丑", "表情包", "整活"], moods: ["playful", "funny"] },
  { words: ["旅行", "徒步", "山", "公园", "花", "草地", "野餐"], moods: ["chill", "soft"] },
  { words: ["上班", "加班", "疲惫", "地铁", "通勤"], moods: ["cool", "calm"] }
];
