/* Six living animals, drawn as simplified lateral skeletons with their soft tissue.
   World frame is 1000 x 620 units; every animal faces right; ground at y = 560. */
(function () {
  'use strict';
  const { noise, fbm, mix, sstep } = SW;
  const A = [];

  // =====================================================================
  // HOUSE CAT
  // =====================================================================
  A.push({
    id: 'cat', name: 'House cat', latin: 'Felis catus', size: 'about 46 cm, head and body', unitsPerM: 1100, shadow: [540, 560, 260, 10], frame: [100, 120, 800, 496],
    params: { wrap: 13, skinT: 2, boneR: 3.6, plump: 30, boneShow: 0.12, furAmp: 2.4, fur: true, tex: 'fur', texAmp: 0.9, skinCol: [196, 160, 148], skinSpec: 0.14, coatSpec: 0.03, blend: 4 },
    coat(x, y) {
      const n = fbm(x * 0.03, y * 0.03);
      const base = [140, 131, 118], dark = [58, 53, 47], light = [222, 214, 199];
      const st = Math.sin(x * 0.115 + n * 6.5 + y * 0.015) * (0.75 + 0.5 * noise(x * 0.05, y * 0.05));
      let c = mix(base, dark, sstep(0.55, 0.95, st) * 0.8);
      const belly = sstep(372, 398, y) * (x > 400 && x < 740 ? 1 : 0.4);
      c = mix(c, light, belly * 0.75);
      if (x > 690 && y > 285 && y < 400) c = mix(c, light, sstep(700, 730, x) * 0.55);
      const muzzle = Math.max(1 - sstep(8, 15, Math.hypot(x - 835, (y - 264) * 1.15)), 1 - sstep(7, 14, Math.hypot((x - 824) * 0.8, y - 281)));
      c = mix(c, light, muzzle * 0.9);
      return c;
    },
    hides: [
      'Jaw muscles fill the deep hollow behind each eye and bulge over the cheek arch. The skull’s open “window” there is never visible in life.',
      'Lips cover the canines. Ears, whisker pads and nose leather have no bone in them at all.',
      'Fur roughly doubles the tail’s width and softens every joint into one smooth outline.'
    ],
    parallel: 'Whether theropods like Tyrannosaurus had lips is the same question. A 2023 study in Science by Cullen and colleagues argued that they did, with lizard-like tissue sealing over the teeth.',
    build(b) {
      // far limbs
      b.far = true;
      b.chain([[688, 352], [692, 430], [704, 512], [720, 546], [734, 556]], [5, 3.6, 2.4, 1.8], 1.25);
      b.chain([[384, 318], [420, 408], [394, 494], [420, 548], [434, 557]], [4.6, 4, 2.4, 1.6], 1.25);
      b.far = false;
      // column
      b.spine([[744, 262], [722, 272], [700, 290], [684, 304]], 7, { r: [6.5, 6], h: [3, 12, 4, 4, 5, 6, 8], tilt: [0, 0.2], gap: 0.12 });
      const th = b.spine([[680, 304], [640, 299], [600, 294], [555, 291], [512, 290]], 13, { r: [5.8, 6], h: [22, 24, 23, 21, 19, 17, 15, 13, 12, 11, 10, 10, 10], tilt: [0.6, -0.1], gap: 0.16 });
      b.ribs(th, [62, 74, 84, 90, 94, 96, 96, 94, 90, 82, 72, 60, 48], { r: [2.5, 1.6], sweep: [0.16, 0.3], end: [0.18, -0.05] });
      b.tube('bone', [[694, 362], [664, 382], [616, 392], [578, 392]], [3.6, 3]);
      b.spine([[508, 290], [470, 287], [432, 284], [398, 288]], 7, { r: [7, 7.5], h: [12, 14, 14, 14, 13, 12, 11], tilt: [-0.4, -0.5], gap: 0.14 });
      b.spine([[394, 289], [376, 294], [358, 300]], 3, { r: [7, 6], h: [9, 8, 7], tilt: [-0.2, -0.1], gap: 0.02 });
      b.spine([[352, 302], [338, 306], [310, 318], [275, 330], [235, 332], [195, 320], [168, 295], [152, 262], [148, 228], [155, 200]], 22, { r: [5, 2.4], h: [5, 0], tilt: 0, gap: 0.22, arch: false });
      // shoulder + near forelimb
      b.shape('bone', [[650, 296], [690, 288], [700, 298], [690, 326], [680, 348], [668, 354], [656, 338], [646, 312]]);
      b.tube('bone', [[664, 296], [670, 322], [676, 344]], [2.2, 1.6]);
      b.bone(674, 350, 660, 430, 5.5, 4.2, 1.3);
      b.bone(652, 424, 668, 514, 3.2, 2.4, 1.2);
      b.bone(664, 436, 676, 514, 2.8, 3, 1.2);
      b.circle('bone', 651, 419, 4.2);
      b.circle('bone', 672, 520, 3.6); b.circle('bone', 678, 522, 3.2);
      b.chain([[677, 526], [690, 548], [700, 555], [708, 557]], [2.2, 1.8, 1.4], 1.2);
      b.claw(708, 556, 9, 0.25, 1.6);
      // pelvis + near hindlimb
      b.shape('bone', [[418, 280], [404, 276], [386, 292], [372, 308], [356, 316], [336, 312], [332, 322], [346, 330], [364, 330], [378, 322], [392, 304], [414, 290]]);
      b.ellipse('hole', 356, 322, 7, 3.5, 0);
      b.bone(374, 316, 402, 408, 5, 4.5, 1.3);
      b.ellipse('bone', 409, 403, 3.5, 5, 0.3);
      b.bone(400, 412, 362, 498, 4.6, 3.4, 1.25);
      b.tube('bone', [[396, 418], [358, 496]], [1.6, 1.4]);
      b.tube('bone', [[366, 498], [350, 490]], [4, 3.6]); b.circle('bone', 362, 505, 4);
      b.chain([[364, 507], [386, 549], [397, 556], [404, 558]], [2.6, 1.8, 1.4], 1.2);
      b.claw(404, 557, 9, 0.25, 1.5);
      // skull
      b.local(742, 252, 1.0, 0.06, 'head', () => {
        b.shape('bone', [[6, 6], [1, -4], [3, -16], [10, -27], [22, -35], [36, -38], [50, -36], [60, -31], [70, -25], [80, -19], [89, -13], [95, -8], [98, -2], [97, 4], [92, 6], [80, 7], [66, 8], [56, 8], [50, 4], [42, 6], [30, 8], [20, 12], [12, 12]]);
        b.shape('recess', [[16, -24], [30, -30], [46, -27], [51, -14], [47, -2], [30, 2], [16, -2], [12, -12]], { depth: 0.55 });
        b.circle('recess', 61, -15, 12.5, { depth: 0.95 });
        b.shape('recess', [[90, -12], [96, -6], [96, 0], [90, -4]], { depth: 0.5 });
        b.shape('bone', [[20, 8], [24, 3], [29, -5], [33, -15], [37, -13], [41, -1], [48, 9], [62, 11], [76, 11], [88, 10], [95, 9], [98, 13], [95, 19], [86, 22], [70, 24], [52, 25], [36, 24], [24, 22], [15, 20], [17, 13]]);
        b.shape('recess', [[24, 10], [30, 0], [36, -6], [44, 8], [36, 18], [26, 18]], { depth: 0.35 });
        b.ellipse('bone', 21, 8, 4.2, 2.6, 0);
        b.tube('bone', [[47, -31], [49, -24], [50, -19]], [2.4, 1.0]);
        b.tube('bone', [[69, -1], [58, 2], [45, 3], [32, 2], [20, -1]], [3.2, 3, 2.6, 2.6, 3]);
        b.tube('bone', [[52, 1], [53, -6]], [2.2, 1]);
        // lower teeth
        b.shape('teeth', [[90, 11], [94, 11], [96, 4], [95, -1], [92, 5]]);
        b.tooth('teeth', 96.5, 10, 2, -3);
        b.shape('teeth', [[60, 11], [72, 11], [70, 7], [67, 5], [65, 8], [62, 6]]);
        b.shape('teeth', [[76, 11], [84, 11], [82, 7], [79, 6]]);
        // upper teeth
        b.shape('teeth', [[87.5, 4], [93, 4], [93, 10], [90, 19.5], [88, 12]]);
        b.tooth('teeth', 95.5, 5, 2.2, 3.5); b.tooth('teeth', 97.6, 4, 2, 3);
        b.shape('teeth', [[74, 7], [82, 7], [80, 11], [78, 13], [76, 10]]);
        b.shape('teeth', [[58, 8], [73, 8], [71, 12], [68, 15], [65, 11], [62, 14], [59, 11]]);
        // head tissue
        b.shape('tissue', [[-4, -6], [0, -28], [16, -43], [38, -48], [56, -45], [68, -36], [80, -27], [92, -19], [101, -11], [106, -3], [106, 8], [100, 16], [92, 23], [80, 28], [60, 33], [40, 36], [18, 36], [0, 24]]);
        b.ellipse('tissue', 94, 5, 11, 9, 0);
        b.ellipse('tissue', 84, 23, 12, 6, 0);
        b.shape('tissue', [[6, -30], [11, -68], [18, -74], [32, -56], [46, -42]]);
        b.shape('tissue', [[16, -42], [17, -63], [20, -67], [30, -52], [36, -44]], { color: '#c79c92', fur: false, spec: 0.1 });
        b.shape('tissue', [[99, -9], [106, -5], [106, 0], [100, 0]], { color: '#c38a83', fur: false, spec: 0.45 });
        b.eye(61, -15, 8.6, { iris: '#b4bf42', irisHi: '#e2e48a', pupil: 'slit', rS: 11.5, open: 0.8 });
        b.line([[104, 6], [101, 10], [95, 12.5], [84, 14.5]], { w: 0.9, color: '#2a2420' });
        b.line([[95, 3], [112, -3], [129, -7]], { w: 0.45, color: 'rgba(246,242,232,0.95)' });
        b.line([[95, 5], [113, 4], [131, 4]], { w: 0.45, color: 'rgba(246,242,232,0.95)' });
        b.line([[95, 7], [112, 11], [127, 17]], { w: 0.45, color: 'rgba(246,242,232,0.95)' });
        b.line([[66, -26], [74, -34], [80, -40]], { w: 0.4, color: 'rgba(246,242,232,0.85)' });
      });
      // body tissue
      b.far = true;
      b.tube('tissue', [[690, 340], [692, 430], [704, 510], [726, 548]], [22, 12, 9, 8]);
      b.ellipse('tissue', 731, 551, 15, 8, 0);
      b.tube('tissue', [[392, 330], [420, 410], [394, 492], [424, 548]], [24, 13, 8, 8]);
      b.ellipse('tissue', 432, 552, 15, 8, 0);
      b.far = false;
      b.shape('tissue', [[700, 282], [650, 268], [590, 264], [530, 268], [475, 268], [425, 264], [385, 270], [352, 286], [338, 312], [344, 344], [366, 372], [400, 384], [440, 382], [480, 392], [540, 404], [600, 414], [650, 420], [692, 408], [716, 376], [726, 334], [720, 298]]);
      b.tube('tissue', [[750, 260], [724, 284], [702, 314]], [36, 44]);
      b.tube('tissue', [[680, 330], [664, 430], [674, 512], [694, 548]], [30, 16, 11, 10], { edge: 0.8 });
      b.ellipse('tissue', 701, 551, 18, 9, 0, { edge: 0.5 });
      b.shape('tissue', [[426, 296], [446, 340], [436, 402], [412, 432], [386, 436], [358, 404], [340, 352], [350, 306], [384, 288]], { edge: 0.8 });
      b.tube('tissue', [[404, 412], [364, 496], [388, 550]], [16, 10, 8], { edge: 0.8 });
      b.tube('tissue', [[372, 496], [354, 492]], 9);
      b.ellipse('tissue', 402, 553, 17, 8, 0, { edge: 0.5 });
      b.tube('tissue', [[352, 302], [338, 306], [310, 318], [275, 330], [235, 332], [195, 320], [168, 295], [152, 262], [148, 228], [155, 198]], [13, 11]);
    }
  });

  // =====================================================================
  // AFRICAN ELEPHANT
  // =====================================================================
  A.push({
    id: 'elephant', name: 'African elephant', latin: 'Loxodonta africana', size: 'about 3.2 m at the shoulder', unitsPerM: 118, shadow: [470, 560, 300, 14], frame: [130, 100, 790, 490],
    params: { wrap: 16, skinT: 3, boneR: 6, plump: 70, boneShow: 0.07, furAmp: 0, fur: false, tex: 'wrinkle', texAmp: 1.2, bareTex: 'wrinkle', skinCol: [128, 120, 114], skinSpec: 0.1, coatSpec: 0.06, blend: 5 },
    coat(x, y) {
      const n = fbm(x * 0.02, y * 0.02);
      let c = mix([132, 125, 118], [98, 92, 88], n);
      c = mix(c, [150, 136, 120], sstep(470, 560, y) * 0.35);
      return c;
    },
    hides: [
      'The trunk has no bones at all. It is muscle hung from the nasal opening high on the forehead, which is why the skull looks like it has one giant eye socket.',
      'The ears are skin over cartilage, so the skeleton gives no hint of them.',
      'Each foot stands on tiptoe over a thick fatty heel pad. The dainty toe bones become a flat-soled column.'
    ],
    parallel: 'The paleontologist Othenio Abel suggested in 1914 that dwarf-elephant skulls on Mediterranean islands, with that single central nasal hole, inspired the myth of the Cyclops. Reading bones too literally is an old habit.',
    build(b) {
      b.far = true;
      b.chain([[632, 345], [602, 440], [592, 528], [604, 556]], [11, 9, 7], 1.2);
      b.chain([[314, 320], [302, 440], [306, 526], [318, 556]], [11, 9, 7], 1.2);
      b.far = false;
      b.spine([[700, 272], [680, 280], [660, 285]], 7, { r: [9, 9], h: 6, tilt: 0, gap: 0.1 });
      const th = b.spine([[655, 285], [600, 276], [540, 272], [480, 276], [430, 282]], 20, { r: [9, 8], h: [92, 96, 94, 88, 80, 72, 64, 56, 50, 45, 41, 38, 36, 34, 33, 32, 31, 30, 30, 30], tilt: [0.55, 0.15], gap: 0.12 });
      b.ribs(th, [86, 100, 110, 116, 119, 120, 120, 119, 116, 113, 110, 105, 100, 94, 88, 82, 75, 67, 59, 50], { r: [5, 3.2], sweep: [0.12, 0.26], end: [0.14, 0] });
      b.tube('bone', [[664, 372], [636, 390], [590, 396]], [6, 5]);
      b.spine([[425, 282], [390, 280], [360, 278]], 3, { r: 9, h: 30, tilt: -0.1, gap: 0.1 });
      b.spine([[355, 278], [325, 280], [300, 284]], 4, { r: 8, h: 22, tilt: -0.05, gap: 0.02 });
      b.spine([[294, 288], [272, 300], [256, 330], [248, 370], [244, 410], [242, 445]], 24, { r: [6, 2], h: [8, 0], tilt: 0, gap: 0.2, arch: false });
      // scapula + forelimb
      b.shape('bone', [[592, 205], [630, 198], [648, 230], [652, 300], [646, 335], [630, 342], [620, 300], [598, 240]]);
      b.tube('bone', [[612, 212], [628, 270], [640, 330]], [4, 2.5]);
      b.bone(640, 338, 622, 440, 13, 10, 1.2);
      b.bone(616, 432, 628, 528, 9, 8, 1.15);
      b.bone(630, 446, 636, 528, 6, 7, 1.1);
      b.circle('bone', 628, 534, 8); b.circle('bone', 640, 534, 7);
      b.chain([[634, 540], [648, 552], [656, 557]], [5, 4], 1.2);
      b.chain([[622, 540], [626, 556]], [4, 3], 1.2);
      // pelvis + hindlimb
      b.shape('bone', [[330, 218], [362, 232], [354, 268], [342, 300], [334, 325], [322, 352], [306, 356], [296, 340], [300, 318], [288, 290], [292, 252], [300, 228]]);
      b.ellipse('hole', 312, 338, 8, 6, 0.3);
      b.bone(322, 316, 338, 440, 12, 10, 1.2);
      b.ellipse('bone', 347, 434, 6, 8, 0.2);
      b.bone(336, 442, 326, 525, 10, 8.5, 1.15);
      b.tube('bone', [[330, 446], [318, 524]], [3.5, 3]);
      b.circle('bone', 324, 532, 9);
      b.chain([[328, 538], [342, 552], [350, 557]], [5, 4], 1.2);
      b.chain([[318, 540], [318, 556]], [4, 3], 1.2);
      // skull
      b.local(700, 268, 1.35, 0.05, 'head', () => {
        b.shape('bone', [[0, 0], [-6, -20], [-4, -45], [4, -62], [20, -72], [40, -70], [56, -62], [64, -48], [66, -34], [70, -15], [74, 5], [76, 25], [74, 40], [66, 42], [58, 30], [50, 20], [40, 22], [28, 18], [16, 12], [6, 8]]);
        b.shape('recess', [[52, -64], [63, -59], [67, -45], [63, -34], [54, -40]], { depth: 1.0 });
        b.circle('recess', 42, -18, 7.5, { depth: 0.95 });
        b.shape('recess', [[10, -48], [30, -52], [40, -36], [36, -8], [16, -4], [6, -20]], { depth: 0.5 });
        b.shape('recess', [[66, 8], [72, 10], [72, 34], [66, 34]], { depth: 0.25 });
        b.shape('bone', [[4, 10], [6, -4], [12, -6], [16, 6], [26, 14], [40, 24], [54, 30], [62, 40], [64, 52], [56, 54], [44, 48], [30, 46], [14, 42], [4, 32], [0, 20]]);
        b.shape('recess', [[8, 8], [16, 4], [24, 20], [14, 34], [6, 26]], { depth: 0.35 });
        b.tube('bone', [[50, -9], [38, -5], [24, -5], [12, -7]], [3.6, 3, 3, 3.4]);
        b.shape('teeth', [[38, 18], [52, 17], [52, 22], [48, 24], [44, 22], [40, 24]]);
        b.shape('teeth', [[34, 25], [50, 27], [50, 22], [34, 22]]);
        b.tube('teethX', [[73, 40], [80, 56], [92, 70], [108, 78], [124, 76], [138, 66]], [8.5, 8.6, 8.2, 7, 5, 2.2]);
        // head tissue
        b.shape('tissue', [[-10, -10], [-6, -50], [6, -74], [26, -82], [46, -78], [62, -66], [70, -48], [74, -20], [80, 10], [84, 38], [74, 58], [56, 62], [40, 56], [20, 52], [0, 40], [-10, 20]]);
        b.tube('tissue', [[64, -40], [76, -10], [83, 30], [84, 70], [82, 110], [84, 150], [92, 186], [104, 200]], [22, 21, 18, 15, 12, 10, 8, 6.5], { group: 'trunk' });
                b.line([[0, -40], [-10, -10], [-8, 20], [-4, 40]], { w: 1.2, color: 'rgba(40,36,34,0.45)' });
        b.eye(42, -18, 3.4, { iris: '#4a2c18', irisHi: '#7a4a28', pupil: 'round', rS: 6.4, open: 0.7, sclera: '#d8ccb8' });
        b.line([[40, -24], [44, -25], [48, -23]], { w: 0.5, color: '#2a2422' });
        b.line([[74, 44], [66, 52], [56, 56]], { w: 1.1, color: 'rgba(30,26,24,0.7)' });
        for (let i = 0; i < 9; i++) b.line([[78 + i * 0.6, 20 + i * 20], [90 - i * 0.2, 22 + i * 20]], { w: 0.7, color: 'rgba(40,36,34,0.5)' });
      });
      // body tissue
      b.far = true;
      b.tube('tissue', [[628, 345], [600, 440], [592, 525]], [40, 32, 30]);
      b.shape('tissue', [[566, 516], [618, 516], [626, 557], [560, 558]]);
      b.tube('tissue', [[312, 330], [300, 440], [304, 525]], [40, 32, 30]);
      b.shape('tissue', [[278, 516], [330, 516], [336, 557], [272, 558]]);
      b.far = false;
      b.shape('tissue', [[660, 240], [620, 175], [560, 178], [500, 190], [440, 196], [380, 192], [320, 190], [270, 205], [245, 240], [238, 300], [248, 360], [268, 392], [300, 414], [360, 410], [440, 404], [520, 408], [600, 418], [650, 416], [690, 392], [705, 340], [702, 290]]);
      b.tube('tissue', [[640, 330], [628, 440], [632, 520]], [46, 36, 34], { edge: 0.8 });
      b.shape('tissue', [[602, 516], [662, 516], [670, 557], [596, 558]]);
      b.shape('tissue', [[350, 260], [372, 330], [364, 430], [342, 450], [310, 440], [296, 380], [300, 300]], { edge: 0.8 });
      b.tube('tissue', [[338, 440], [326, 526]], [36, 34]);
      b.shape('tissue', [[294, 516], [358, 516], [364, 557], [290, 558]]);
      b.tube('tissue', [[294, 288], [272, 300], [256, 330], [248, 370], [244, 410], [242, 445]], [9, 5]);
      b.ellipse('tissue', 242, 456, 5, 14, 0, { color: '#2a2624' });
      b.local(700, 268, 1.35, 0.05, 'head', () => {
        b.shape('tissue', [[8, -62], [-20, -78], [-60, -72], [-86, -42], [-92, 0], [-82, 40], [-58, 72], [-36, 82], [-18, 66], [-6, 30], [2, 0]], { color: '#69635d', fur: false, spec: 0.05, edge: 1, edgeFull: true });
      });
      for (let i = 0; i < 2; i++) { b.dot(648 + i * 14, 551, 5, 3, { color: 'rgba(196,186,166,0.6)' }); b.dot(340 + i * 14, 551, 5, 3, { color: 'rgba(196,186,166,0.6)' }); }
    }
  });

  // =====================================================================
  // MUTE SWAN
  // =====================================================================
  A.push({
    id: 'swan', name: 'Mute swan', latin: 'Cygnus olor', size: 'about 1.5 m long', unitsPerM: 276, shadow: [500, 560, 190, 9], frame: [200, 125, 726, 450],
    params: { wrap: 9, skinT: 1.5, boneR: 3, plump: 26, boneShow: 0.04, furAmp: 1.2, fur: true, tex: 'feather', texAmp: 0.8, skinCol: [214, 178, 164], sTex: 'follicle', sTexAmp: 0.6, skinSpec: 0.15, coatSpec: 0.05, blend: 4 },
    coat(x, y) {
      let c = mix([241, 239, 233], [214, 214, 210], fbm(x * 0.04, y * 0.04) * 0.5);
      if (x > 690 && y < 205) c = mix(c, [226, 208, 176], 0.35);
      return c;
    },
    hides: [
      'Feathers thicken the neck several times over and smooth away the kinked S of its 24 or so vertebrae.',
      'The orange bill is a keratin sheath over the bone, and the black knob at its base is fleshy. Neither fossilises.',
      'Folded wing feathers and down roughly double the body’s depth, and the webs between the toes leave no trace in the bones.'
    ],
    parallel: 'Once filaments and feathers turned up on dozens of theropods, the scaly, shrink-wrapped Velociraptor became the standard example of the problem. A bird’s skeleton badly understates the bird.',
    build(b) {
      b.far = true;
      b.chain([[468, 392], [488, 430], [500, 500], [500, 538]], [4, 3.6, 3.2], 1.2);
      b.chain([[500, 538], [516, 548], [530, 553], [540, 555]], [2, 1.2], 1.2);
      b.far = false;
      b.spine([[718, 166], [700, 168], [684, 176], [670, 194], [664, 220], [668, 250], [678, 280], [684, 310], [680, 340], [664, 364], [640, 380], [612, 388]], 24, { r: [4.4, 6.6], h: [2, 4], tilt: 0.2, gap: 0.12, sw: 0.4 });
      const th = b.spine([[606, 390], [575, 388], [545, 384]], 5, { r: 6.5, h: 9, tilt: 0.1, gap: 0.05 });
      b.ribs(th, [46, 60, 66, 64, 54], { r: [2.4, 1.6], sweep: [0.15, 0.35], end: [0.0, 0.25], unc: 0.28 });
      b.spine([[540, 383], [490, 380], [440, 382]], 8, { r: 5.5, h: 4, gap: 0, arch: false });
      b.spine([[435, 384], [420, 388], [405, 392]], 5, { r: 4.2, h: 5, tilt: -0.2, gap: 0.2 });
      b.shape('bone', [[402, 388], [384, 382], [378, 392], [392, 400]]);
      b.shape('bone', [[614, 438], [606, 468], [580, 478], [540, 476], [500, 468], [478, 456], [500, 452], [540, 452], [580, 446], [604, 436]]);
      b.tube('bone', [[612, 446], [592, 474], [540, 478], [496, 466]], 2);
      b.bone(600, 394, 614, 440, 4, 3.5);
      b.tube('bone', [[608, 390], [626, 416], [618, 442]], [2.2, 1.6, 2]);
      b.tube('bone', [[600, 386], [560, 386], [510, 392]], [3.6, 2.6, 1.4]);
      b.shape('bone', [[548, 374], [500, 366], [452, 368], [424, 382], [436, 400], [470, 406], [516, 398], [546, 390]]);
      b.circle('hole', 474, 392, 4.2); b.ellipse('hole', 448, 394, 8, 3, 0);
      // folded wing
      b.bone(602, 394, 536, 414, 5, 4.2);
      b.bone(536, 412, 610, 396, 3.6, 3.2);
      b.tube('bone', [[540, 418], [608, 402]], 1.8);
      b.bone(612, 398, 568, 404, 3.4, 2.6);
      b.chain([[568, 404], [548, 405], [536, 406]], [2.2, 1.4]);
      // near leg
      b.bone(472, 392, 500, 428, 4.6, 4.2);
      b.bone(500, 428, 476, 500, 4, 3.4);
      b.tube('bone', [[496, 434], [488, 462]], [1.4, 0.8]);
      b.bone(476, 500, 486, 536, 3.6, 3.2);
      b.chain([[486, 536], [500, 544], [514, 550], [526, 554], [534, 556]], [2.2, 1.4], 1.2);
      b.chain([[486, 537], [504, 550], [518, 557], [528, 559]], [2, 1.2], 1.2);
      b.chain([[484, 538], [476, 544]], [1.6, 1.2], 1.2);
      // skull
      b.local(722, 162, 0.72, 0.12, 'head', () => {
        b.shape('bone', [[0, 4], [-3, -6], [2, -16], [12, -21], [24, -20], [32, -14], [44, -10], [60, -8], [76, -7], [90, -6], [98, -3], [100, 1], [96, 3], [80, 2], [60, 1], [40, 1], [30, 2], [22, 6], [14, 10], [6, 10]]);
        b.shape('hole', [[10, 2], [28, 0], [33, 2], [12, 5]]);
        b.circle('recess', 19, -9, 8, { depth: 1 });
        b.ellipse('hole', 54, -4.5, 8, 2, 0);
        b.shape('bone', [[2, 6], [8, 4], [30, 4], [60, 4], [86, 4], [99, 3], [96, 7], [80, 8], [50, 9], [24, 10], [8, 10]]);
        b.ellipse('hole', 28, 7, 4, 1, 0);
        b.tube('bone', [[3, -1], [5, 6]], 2);
        b.ring(19, -9, 5.6, 1.6, 14);
        b.shape('tissue', [[-6, 2], [-5, -12], [3, -24], [18, -29], [30, -23], [36, -15], [40, -9], [38, 6], [24, 14], [8, 14]]);
        b.shape('tissue', [[32, -15], [46, -11], [62, -9], [78, -8], [92, -7], [100, -3], [102, 2], [96, 6], [80, 6], [60, 5], [42, 6], [34, 5], [30, -4]], { color: '#de7428', fur: false, spec: 0.35 });
        b.shape('tissue', [[94, -6], [101, -3], [103, 2], [97, 3]], { color: '#191715', fur: false, spec: 0.5 });
        b.shape('tissue', [[17, -6], [29, -14], [34, 1], [24, 3]], { color: '#191715', fur: false, spec: 0.2 });
        b.shape('tissue', [[28, -14], [31, -21], [38, -19.5], [43, -12], [34, -11]], { color: '#191715', fur: false, spec: 0.35 });
        b.eye(19, -9, 2.8, { iris: '#2b1b10', irisHi: '#4a3020', pupil: 'round', rS: 6.6, open: 0.85 });
        b.line([[100, 2.5], [80, 4], [50, 4], [34, 4.5]], { w: 0.6, color: '#3a1c0c' });
        b.dot(56, -4, 4, 1.1, { color: '#3a1c0c' });
      });
      // tissue
      b.far = true;
      b.tube('tissue', [[496, 456], [500, 500], [500, 536]], [6, 4.5, 4], { color: '#2a2724', fur: false, spec: 0.2 });
      b.shape('tissue', [[494, 534], [506, 532], [548, 552], [552, 560], [494, 560]], { color: '#2a2724', fur: false, spec: 0.2 });
      b.far = false;
      b.tube('tissue', [[716, 164], [700, 168], [684, 176], [670, 194], [664, 220], [668, 250], [678, 280], [684, 310], [680, 340], [664, 364], [640, 380], [612, 392]], [11, 12, 12, 13, 14, 15, 16, 17, 20, 25, 32, 40]);
      b.shape('tissue', [[618, 360], [590, 345], [540, 336], [490, 334], [440, 338], [400, 346], [365, 356], [338, 370], [350, 384], [380, 398], [400, 426], [440, 456], [500, 480], [560, 486], [606, 468], [634, 430], [638, 392]]);
      b.shape('tissue', [[610, 372], [580, 350], [530, 342], [470, 342], [420, 350], [372, 364], [348, 378], [400, 390], [460, 398], [520, 406], [580, 406], [606, 392]], { edge: 0.9, edgeFull: true });
      b.tube('tissue', [[490, 470], [478, 500], [486, 536]], [7, 4.5, 4], { color: '#2a2724', fur: false, spec: 0.2, edge: 0.6 });
      b.shape('tissue', [[478, 534], [494, 532], [536, 550], [540, 559], [478, 560]], { color: '#2a2724', fur: false, spec: 0.2, edge: 0.6 });
      b.line([[486, 538], [534, 556]], { w: 0.9, color: 'rgba(0,0,0,0.6)' });
    }
  });

  // =====================================================================
  // AMERICAN BISON
  // =====================================================================
  A.push({
    id: 'bison', name: 'American bison', latin: 'Bison bison', size: 'about 1.8 m at the shoulder', unitsPerM: 205, shadow: [500, 560, 290, 13], frame: [190, 120, 730, 452],
    params: { wrap: 14, skinT: 2.4, boneR: 5, plump: 40, boneShow: 0.06, furAmp: 4.5, fur: true, tex: 'wool', texAmp: 1.4, skinCol: [156, 124, 110], skinSpec: 0.12, coatSpec: 0.03, blend: 5 },
    coat(x, y) {
      const f = sstep(380, 600, x - (y - 300) * 0.25), n = fbm(x * 0.03, y * 0.03);
      let c = mix([134, 96, 60], [56, 39, 26], f);
      c = mix(c, [44, 31, 22], (n - 0.4) * 0.6);
      return c;
    },
    hides: [
      'The hump is real bone. Long spines on the shoulder vertebrae anchor the ligament that holds up the heavy head, so here the skeleton gets it right.',
      'The horns are keratin sheaths, longer and sharper than the stubby bony cores the skull keeps.',
      'Thick wool on the head, beard, shoulders and forelegs can roughly double the depth of the front end. There are no upper front teeth either; a tough dental pad covers the gap.'
    ],
    parallel: 'In 1997 Jack Bailey argued that tall-spined dinosaurs such as Ouranosaurus and Spinosaurus may have carried bison-like humps rather than thin sails. The bones alone do not settle which.',
    build(b) {
      b.far = true;
      b.chain([[660, 352], [640, 432], [630, 512], [640, 546], [652, 558]], [11, 8, 5.5, 4], 1.2);
      b.chain([[332, 314], [350, 412], [326, 500], [322, 546], [330, 558]], [10, 8, 5, 4], 1.2);
      b.far = false;
      b.spine([[740, 304], [718, 296], [694, 292], [672, 295]], 7, { r: 10, h: [6, 16, 8, 8, 8, 10, 14], tilt: 0.3, gap: 0.1 });
      const th = b.spine([[668, 296], [620, 292], [570, 290], [520, 290], [470, 292], [430, 294]], 14, { r: 9.5, h: [100, 118, 122, 118, 108, 96, 82, 68, 56, 46, 38, 32, 28, 26], tilt: [0.5, 0.15], gap: 0.12, sw: 0.42 });
      b.ribs(th, [100, 118, 130, 138, 142, 144, 144, 142, 138, 132, 124, 114, 102, 90], { r: [4.2, 2.8], sweep: [0.12, 0.28], end: [0.15, 0] });
      b.tube('bone', [[682, 400], [650, 426], [600, 438], [560, 436]], [6, 5]);
      b.spine([[425, 294], [390, 292], [355, 292]], 5, { r: 10, h: 24, tilt: -0.25, gap: 0.12 });
      b.spine([[350, 292], [325, 294], [300, 298]], 5, { r: 9, h: 18, tilt: -0.1, gap: 0.02 });
      b.spine([[294, 302], [278, 318], [268, 350], [262, 390], [260, 425]], 18, { r: [6, 2.5], h: [6, 0], tilt: 0, gap: 0.2, arch: false });
      b.shape('bone', [[630, 215], [668, 215], [676, 250], [668, 320], [660, 352], [646, 354], [640, 320], [624, 250]]);
      b.tube('bone', [[648, 220], [654, 290], [656, 340]], [3, 2]);
      b.bone(655, 350, 668, 432, 12, 9);
      b.bone(652, 420, 662, 512, 5, 4);
      b.bone(668, 438, 664, 512, 8, 7);
      b.circle('bone', 650, 414, 8);
      b.circle('bone', 664, 518, 7); b.circle('bone', 672, 520, 6);
      b.bone(666, 524, 668, 542, 6, 5);
      b.chain([[668, 542], [676, 552], [684, 558]], [4, 3.2], 1.2);
      b.shape('bone', [[400, 262], [378, 258], [352, 276], [330, 300], [300, 312], [294, 326], [312, 332], [338, 322], [362, 300], [396, 282]]);
      b.ellipse('hole', 318, 322, 8, 4, 0.2);
      b.bone(338, 312, 378, 410, 11, 9);
      b.ellipse('bone', 386, 402, 5, 7, 0.3);
      b.bone(376, 412, 352, 498, 8, 6.5);
      b.tube('bone', [[356, 498], [332, 488]], [6, 5.5]);
      b.circle('bone', 354, 504, 7);
      b.bone(354, 508, 370, 544, 5.5, 5);
      b.chain([[370, 544], [380, 554], [390, 558]], [4, 3.2], 1.2);
      b.local(742, 300, 1.13, 0.62, 'head', () => {
        b.shape('bone', [[0, 4], [-4, -8], [0, -20], [10, -26], [24, -28], [34, -24], [44, -20], [60, -16], [76, -12], [90, -8], [100, -2], [102, 4], [96, 8], [84, 6], [70, 8], [58, 12], [42, 14], [32, 12], [20, 10], [10, 10]]);
        b.shape('recess', [[6, -18], [20, -22], [28, -12], [22, 0], [8, 0]], { depth: 0.4 });
        b.circle('recess', 36, -14, 7.5, { depth: 0.95 });
        b.shape('recess', [[78, -10], [96, -6], [98, 0], [86, -2]], { depth: 0.6 });
        b.shape('bone', [[6, 8], [10, -10], [16, -10], [20, 4], [34, 18], [60, 20], [86, 16], [100, 10], [104, 14], [98, 20], [80, 24], [56, 28], [30, 30], [12, 28], [4, 20]]);
        b.shape('recess', [[10, 6], [18, 2], [26, 18], [14, 24]], { depth: 0.35 });
        const rim = []; for (let i = 0; i <= 10; i++) { const a = -2.6 + i * 0.36; rim.push([36 + Math.cos(a) * 9, -14 + Math.sin(a) * 9]); }
        b.tube('bone', rim, 2.2);
        b.tube('bone', [[44, -4], [30, -2], [18, 0]], 3);
        b.tube('bone', [[14, -24], [11, -40], [17, -54], [28, -61]], [9, 7, 5, 2.5]);
        b.shape('teeth', [[40, 12], [64, 10], [64, 16], [40, 17]]);
        b.shape('teeth', [[42, 19], [66, 18], [66, 22], [42, 23]]);
        b.shape('teeth', [[98, 10], [106, 6], [107, 9], [100, 13]]);
        b.shape('tissue', [[-14, 0], [-12, -30], [0, -44], [20, -46], [40, -34], [60, -24], [80, -16], [96, -10], [106, -2], [108, 8], [102, 16], [90, 24], [70, 34], [50, 44], [30, 52], [10, 50], [-8, 34]], { color: '#2f2219' });
        b.shape('tissue', [[40, 20], [70, 28], [66, 60], [50, 76], [34, 60], [30, 34]], { color: '#251a12' });
        b.shape('tissue', [[92, -6], [106, -2], [109, 8], [101, 12], [92, 5]], { color: '#1d1916', fur: false, spec: 0.45 });
        b.tube('tissue', [[14, -24], [10, -44], [18, -62], [32, -72], [44, -74]], [11, 9, 7, 4, 1.2], { color: '#1b1917', fur: false, spec: 0.5, edge: 0.7 });
        b.eye(36, -14, 4.6, { iris: '#3a2414', irisHi: '#6a4428', pupil: 'hbar', rS: 7.5, open: 0.72, lid: '#7a5a40' });
        b.dot(101, 1, 3, 1.5, { color: '#050505' });
        b.line([[107, 10], [97, 14], [86, 16]], { w: 0.9, color: '#0d0a08' });
      });
      // tissue
      b.far = true;
      b.tube('tissue', [[650, 350], [640, 432], [630, 512], [640, 546]], [34, 22, 11, 9], { color: '#2e2118' });
      b.shape('tissue', [[628, 542], [650, 542], [660, 560], [624, 560]], { color: '#1b1917', fur: false, spec: 0.35 });
      b.tube('tissue', [[340, 330], [350, 412], [326, 500], [322, 544]], [30, 14, 9, 8]);
      b.shape('tissue', [[310, 542], [332, 542], [340, 560], [306, 560]], { color: '#1b1917', fur: false, spec: 0.35 });
      b.far = false;
      b.shape('tissue', [[690, 330], [680, 240], [650, 165], [600, 150], [540, 172], [490, 200], [440, 222], [390, 236], [340, 240], [300, 250], [280, 280], [280, 330], [296, 390], [330, 428], [380, 446], [440, 450], [520, 456], [600, 470], [660, 470], [700, 440], [716, 390]]);
      b.shape('tissue', [[704, 300], [694, 200], [644, 140], [590, 150], [574, 220], [596, 330], [636, 470], [700, 452], [724, 380]]);
      b.tube('tissue', [[655, 340], [668, 432], [664, 512], [668, 540]], [40, 26, 13, 10], { color: '#33251b', edge: 0.6 });
      b.shape('tissue', [[640, 400], [690, 395], [694, 470], [682, 494], [648, 490]], { color: '#2c1f16' });
      b.shape('tissue', [[656, 540], [680, 540], [692, 560], [652, 560]], { color: '#1b1917', fur: false, spec: 0.35 });
      b.shape('tissue', [[400, 250], [410, 320], [396, 400], [372, 430], [340, 426], [310, 380], [300, 300], [330, 260]], { edge: 0.6 });
      b.tube('tissue', [[378, 410], [352, 498], [370, 544]], [16, 10, 8], { edge: 0.6 });
      b.tube('tissue', [[356, 498], [334, 490]], 8);
      b.shape('tissue', [[360, 542], [384, 542], [394, 560], [356, 560]], { color: '#1b1917', fur: false, spec: 0.35 });
      b.tube('tissue', [[294, 302], [278, 318], [268, 350], [262, 390], [260, 425]], [7, 4]);
      b.ellipse('tissue', 260, 440, 7, 18, 0, { color: '#21170f' });
    }
  });

  // =====================================================================
  // BARN OWL
  // =====================================================================
  A.push({
    id: 'owl', name: 'Barn owl', latin: 'Tyto alba', size: 'about 35 cm tall', unitsPerM: 1300, frame: [250, 95, 710, 440], noFloor: true, shadow: [600, 518, 60, 5],
    params: { wrap: 7, skinT: 1.2, boneR: 2.6, plump: 30, boneShow: 0.03, furAmp: 1.6, fur: true, tex: 'feather', texAmp: 0.7, skinCol: [208, 172, 160], sTex: 'follicle', sTexAmp: 0.5, skinSpec: 0.15, coatSpec: 0.05, blend: 4 },
    coat(x, y) {
      const buff = mix([200, 152, 92], [150, 140, 128], fbm(x * 0.08, y * 0.08) * 0.55), white = [242, 236, 224];
      let d = sstep(612, 584, x);
      if (y < 215 && x < 660) d = Math.max(d, sstep(214, 176, y));
      let c = mix(white, buff, d);
      if (d < 0.5 && noise(x * 0.5, y * 0.5) > 0.8) c = mix(c, [90, 70, 50], 0.5);
      return c;
    },
    bg(ctx) {
      const g = ctx.createLinearGradient(0, 518, 0, 556); g.addColorStop(0, '#4a3a2c'); g.addColorStop(1, '#1e1812');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(430, 524); ctx.bezierCurveTo(520, 512, 700, 512, 800, 520); ctx.lineTo(800, 560); ctx.bezierCurveTo(700, 556, 520, 556, 430, 562); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(440 + i * 50, 526 + (i % 2) * 6); ctx.bezierCurveTo(470 + i * 50, 530, 500 + i * 50, 540, 520 + i * 50, 536); ctx.stroke(); }
    },
    hides: [
      'Feathers turn a long-legged, thin-necked bird into a compact, round-headed shape. Most of the leg is inside the “trousers”.',
      'The eyes are tubes held in bony sclerotic rings, too large to roll in their sockets, which is why owls turn the whole head.',
      'The heart-shaped facial disc is made entirely of feathers. It funnels sound to the ears, which sit at different heights on each side of the skull.'
    ],
    parallel: 'Sclerotic rings do fossilise. Schmitz and Motani (2011) used ring and orbit sizes to argue that some dinosaurs and pterosaurs were active at night.',
    build(b) {
      b.far = true;
      b.bone(566, 360, 590, 396, 3.6, 3.2); b.bone(590, 396, 586, 464, 3, 2.6); b.bone(586, 464, 598, 512, 2.6, 2.4);
      b.chain([[598, 512], [612, 516], [622, 519]], [1.6, 1.2], 1.2); b.claw(622, 519, 8, 0.7, 1.2);
      b.far = false;
      b.spine([[608, 182], [596, 196], [588, 214], [592, 236], [602, 252], [604, 270]], 14, { r: [4.2, 5.2], h: 2, tilt: 0.2, gap: 0.12 });
      const th = b.spine([[604, 274], [596, 300], [584, 322]], 5, { r: 5, h: 6, tilt: 0.1, gap: 0.05 });
      b.ribs(th, [30, 40, 44, 42, 36], { r: [1.8, 1.2], sweep: 0.25, end: 0.2, unc: 0.25 });
      b.spine([[582, 326], [570, 352], [558, 378]], 6, { r: 4.6, h: 4, gap: 0, arch: false });
      b.spine([[555, 384], [548, 398], [542, 410]], 5, { r: 3.4, h: 3, gap: 0.2 });
      b.shape('bone', [[540, 412], [530, 426], [538, 432], [546, 418]]);
      b.shape('bone', [[620, 296], [632, 330], [630, 372], [612, 398], [600, 392], [608, 350], [606, 310]]);
      b.bone(602, 282, 618, 302, 3.2, 3);
      b.tube('bone', [[606, 278], [624, 292], [628, 306]], 1.6);
      b.tube('bone', [[600, 280], [586, 300], [574, 322]], [2.8, 1.6]);
      b.shape('bone', [[588, 318], [562, 330], [548, 372], [554, 394], [572, 384], [586, 350]]);
      b.circle('hole', 570, 360, 3.2);
      b.bone(600, 284, 566, 330, 4, 3.4);
      b.bone(566, 330, 598, 304, 3, 2.6);
      b.tube('bone', [[570, 334], [600, 310]], 1.4);
      b.bone(600, 304, 570, 342, 2.8, 2.2);
      b.chain([[570, 342], [556, 360], [548, 372]], [1.8, 1.1]);
      b.bone(570, 360, 596, 392, 3.8, 3.4); b.bone(596, 392, 570, 462, 3.2, 2.8); b.bone(570, 462, 586, 512, 2.8, 2.6);
      b.chain([[586, 512], [598, 515], [608, 518], [614, 520]], [1.8, 1.3], 1.2); b.claw(614, 520, 9, 0.6, 1.4);
      b.chain([[586, 513], [596, 519], [604, 523]], [1.6, 1.2], 1.2); b.claw(604, 523, 8, 0.9, 1.3);
      b.chain([[585, 514], [574, 517], [566, 519]], [1.6, 1.2], 1.2); b.claw(566, 519, 8, 2.9, 1.3);
      b.local(612, 175, 1.0, 0.35, 'head', () => {
        b.shape('bone', [[0, 6], [-6, -6], [-6, -22], [2, -38], [16, -48], [32, -50], [46, -44], [56, -34], [62, -22], [68, -14], [76, -4], [82, 8], [84, 20], [80, 30], [76, 26], [72, 14], [66, 8], [56, 8], [44, 10], [30, 12], [16, 12], [6, 12]]);
        b.circle('recess', 38, -20, 18, { depth: 1 });
        b.ellipse('hole', 70, -3, 3.6, 2.2, 0.5);
        b.shape('hole', [[28, 4], [54, 2], [60, 6], [32, 8]]);
        b.shape('bone', [[4, 10], [10, 8], [40, 14], [60, 16], [72, 20], [76, 26], [70, 28], [54, 24], [30, 20], [10, 18]]);
        b.tube('bone', [[4, 2], [6, 12]], 2.4);
        b.ring(38, -20, 13, 3.6, 15);
      });
      // tissue
      b.far = true;
      b.tube('tissue', [[590, 396], [586, 464], [598, 512]], [12, 7, 5], { color: '#e9dfcf' });
      b.tube('tissue', [[598, 512], [612, 516], [622, 519]], 2.6, { color: '#8a8070', fur: false, spec: 0.15 });
      b.claw(622, 519, 11, 0.7, 2, 'tissue', { color: '#1b1714', fur: false, spec: 0.5, far: true });
      b.far = false;
      b.ellipse('tissue', 604, 236, 30, 34, 0);
      b.shape('tissue', [[628, 252], [646, 292], [652, 340], [646, 396], [630, 444], [608, 480], [586, 500], [560, 504], [536, 498], [520, 486], [524, 456], [534, 400], [544, 330], [558, 280], [580, 254], [604, 244]]);
      b.shape('tissue', [[570, 262], [602, 286], [604, 340], [590, 414], [564, 466], [530, 500], [516, 498], [522, 440], [534, 356], [550, 292]], { edge: 0.9, edgeFull: true });
      b.tube('tissue', [[596, 392], [574, 462], [584, 508]], [18, 9, 5], { color: '#ece3d4', edge: 0.6 });
      b.tube('tissue', [[586, 512], [598, 515], [608, 518], [614, 520]], 2.8, { color: '#8f8574', fur: false, spec: 0.15 });
      b.tube('tissue', [[586, 513], [596, 519], [604, 523]], 2.6, { color: '#8f8574', fur: false, spec: 0.15 });
      b.tube('tissue', [[585, 514], [574, 517], [566, 519]], 2.6, { color: '#8f8574', fur: false, spec: 0.15 });
      b.claw(614, 520, 12, 0.6, 2.1, 'tissue', { color: '#1b1714', fur: false, spec: 0.5 });
      b.claw(604, 523, 11, 0.9, 2, 'tissue', { color: '#1b1714', fur: false, spec: 0.5 });
      b.claw(566, 519, 11, 2.9, 2, 'tissue', { color: '#1b1714', fur: false, spec: 0.5 });
      b.local(612, 175, 1.0, 0.35, 'head', () => {
        b.shape('tissue', [[-26, 6], [-28, -28], [-14, -58], [12, -74], [40, -78], [64, -66], [80, -44], [90, -16], [93, 12], [88, 38], [72, 56], [46, 64], [18, 62], [-6, 50], [-22, 30]]);
        b.shape('tissue', [[42, -72], [66, -60], [84, -34], [92, -2], [90, 26], [80, 48], [62, 60], [40, 63], [28, 42], [22, 10], [24, -24], [30, -54]], { color: '#f1e9dc' });
        b.line([[44, -72], [30, -54], [24, -24], [22, 10], [28, 42], [40, 63]], { w: 3, color: 'rgba(176,124,70,0.85)' });
        b.shape('tissue', [[68, -2], [77, 0], [84, 12], [85, 24], [80, 32], [75, 22], [71, 10]], { color: '#e2d2b6', fur: false, spec: 0.35 });
        b.line([[70, -1], [80, 10], [82, 26]], { w: 0.8, color: 'rgba(120,96,70,0.6)' });
        b.eye(38, -20, 8, { iris: '#100a07', irisHi: '#2a1a12', pupil: 'round', pupilR: 0.5, rS: 15, open: 0.62 });
      });
    }
  });

  // =====================================================================
  // NILE CROCODILE
  // =====================================================================
  A.push({
    id: 'crocodile', name: 'Nile crocodile', latin: 'Crocodylus niloticus', size: 'about 4 m long', unitsPerM: 210, shadow: [470, 560, 420, 10], frame: [40, 150, 850, 527],
    params: { wrap: 10, skinT: 2, boneR: 3.6, plump: 22, boneShow: 0.55, furAmp: 0, fur: false, tex: 'scale', texAmp: 0.9, skinCol: [112, 108, 76], skinSpec: 0.22, coatSpec: 0.18, blend: 4 },
    coat(x, y) {
      const m = x > 430 ? 486 : 486 + (430 - x) * 0.07;
      let c = mix([118, 114, 72], [74, 76, 46], sstep(m - 6, m - 32, y));
      c = mix(c, [192, 182, 136], sstep(m + 10, m + 28, y));
      if (x < 430) c = mix(c, [52, 52, 34], sstep(0.35, 0.8, Math.sin(x * 0.075)) * 0.45 * (1 - sstep(m + 6, m + 20, y)));
      return mix(c, [60, 62, 40], (fbm(x * 0.05, y * 0.05) - 0.45) * 0.5);
    },
    hides: [
      'This is the control case. Skin is anchored to bony plates (osteoderms) along the back and there are no lips, so shrink-wrapping comes closest to the truth here.',
      'Even so, big jaw-closing muscles bulge out behind the skull, and the tail is wrapped in muscle far beyond its slim bones.',
      'Crocodiles show the big fourth lower tooth in a notch when the mouth is shut. In alligators it is hidden. Teeth can tell you that much.'
    ],
    parallel: 'Crocodilians and birds bracket the dinosaurs on the family tree. Shrink-wrapping borrows the crocodile half of that bracket and ignores the bird half.',
    build(b) {
      b.far = true;
      b.chain([[652, 486], [668, 520], [676, 550], [696, 558]], [7, 5.5, 4], 1.2);
      b.chain([[440, 486], [418, 520], [404, 550], [420, 558]], [8, 6, 4], 1.2);
      b.far = false;
      const cv = b.spine([[742, 468], [720, 466], [700, 463], [680, 462]], 9, { r: 7, h: 9, tilt: 0.1, gap: 0.12 });
      b.ribs(cv, [10, 12, 12, 13, 13, 14, 14, 15, 15], { r: [2, 1.2], sweep: 0.6, end: 0.6 });
      const th = b.spine([[676, 462], [620, 458], [560, 456], [500, 456], [450, 458]], 15, { r: 7, h: 14, tilt: 0.15, gap: 0.12 });
      b.ribs(th.slice(0, 11), [40, 48, 54, 58, 58, 56, 54, 50, 44, 36, 26], { r: [2.4, 1.6], sweep: [0.15, 0.3], end: [0.1, 0] });
      for (let x = 482; x <= 640; x += 12) b.tube('bone', [[x, 506], [x + 8, 515]], 1.2);
      b.spine([[446, 458], [425, 460]], 2, { r: 7, h: 12, gap: 0.04 });
      const cd = b.spine([[420, 461], [380, 465], [330, 472], [270, 482], [210, 494], [150, 508], [100, 522], [62, 535]], 37, { r: [6.5, 1.8], h: [16, 1], tilt: 0.35, chev: [16, 1], gap: 0.15 });
      b.osteoderms(cv, 2, 9, { lift: 14, size: 5 });
      b.osteoderms(th, 0, 15, { lift: [24, 22], size: [7, 6] });
      b.osteoderms(cd, 0, 30, { lift: [25, 5], size: [6.5, 2.5] });
      b.shape('bone', [[612, 450], [632, 446], [640, 488], [628, 492]]);
      b.bone(632, 488, 640, 512, 3.5, 3);
      b.bone(636, 492, 612, 524, 5, 4.2);
      b.bone(612, 524, 626, 552, 3.5, 3);
      b.tube('bone', [[608, 526], [620, 553]], 2.2);
      b.circle('bone', 628, 556, 3);
      b.chain([[628, 556], [642, 558], [652, 559]], [1.8, 1.2], 1.2); b.claw(652, 559, 6, 0.2, 1.1);
      b.chain([[627, 557], [636, 560], [644, 561]], [1.6, 1], 1.2);
      b.shape('bone', [[452, 452], [428, 452], [422, 468], [432, 486], [446, 490], [460, 476]]);
      b.tube('bone', [[440, 482], [426, 508]], [4, 3]);
      b.tube('bone', [[452, 482], [476, 510]], [3, 2.2]);
      b.bone(444, 480, 472, 516, 5.5, 4.6);
      b.bone(472, 516, 450, 550, 4.6, 3.8);
      b.tube('bone', [[466, 518], [444, 550]], 1.8);
      b.tube('bone', [[452, 552], [440, 550]], 3);
      b.bone(452, 554, 488, 558, 3, 2.6);
      b.chain([[488, 558], [502, 560], [512, 561]], [1.8, 1.2], 1.2); b.claw(512, 561, 6, 0.1, 1.1);
      b.local(745, 465, 1.26, -0.02, 'head', () => {
        b.shape('bone', [[0, 2], [-4, -6], [0, -12], [14, -14], [30, -13], [42, -11], [60, -8], [80, -6], [96, -5], [104, -3], [106, 2], [100, 5], [86, 4], [74, 6], [64, 4], [48, 6], [32, 8], [20, 8], [10, 10], [2, 8]]);
        b.ellipse('hole', 13, -4, 6, 3, 0.1);
        b.ellipse('recess', 30, -10, 7, 3.5, 0, { depth: 0.95 });
        b.shape('recess', [[40, -6], [70, -4], [70, 2], [40, 2]], { depth: 0.2 });
        b.ellipse('recess', 102, -4, 3, 1.5, 0, { depth: 0.8 });
        b.shape('bone', [[-6, 6], [-2, 3], [8, 8], [20, 10], [40, 8], [60, 6], [72, 5], [86, 6], [100, 6], [104, 8], [100, 12], [86, 12], [60, 14], [40, 15], [20, 16], [6, 14], [-4, 12]]);
        b.ellipse('hole', 22, 11.5, 6.5, 1.8, 0);
        for (let i = 0; i < 15; i++) {
          const x = 27 + i * 5.3, big = (i === 13 ? 2.2 : i === 9 || i === 10 ? 1.6 : 1);
          if (Math.abs(x - 76) < 3) continue;
          b.tooth('teethX', x, 7.2 - (x - 20) * 0.03, 2.4 * Math.min(1.3, big), 4.6 * big);
        }
        for (let i = 0; i < 14; i++) {
          const x = 30 + i * 5.4, big = Math.abs(x - 78) < 3 ? 2.0 : 1;
          b.tooth('teethX', x + 2.6, 7, 2.3 * Math.min(1.3, big), -4.0 * big);
        }
        b.shape('tissue', [[-8, -6], [-4, -16], [14, -18], [30, -17], [42, -14], [60, -10], [80, -8], [98, -7], [106, -4], [110, 2], [106, 10], [96, 14], [70, 16], [40, 18], [20, 20], [0, 18], [-10, 8]]);
        b.ellipse('tissue', 4, 8, 14, 10, 0, { edge: 0.4 });
        b.ellipse('tissue', 30, -15, 7, 4, 0, { edge: 0.5 });
        b.ellipse('tissue', 103, -6, 4, 2.5, 0);
        b.eye(30, -12.5, 3.4, { iris: '#9a8a3a', irisHi: '#d8c870', pupil: 'slit', rS: 4.6, open: 0.62 });
        b.line([[106, 6], [90, 6.5], [74, 7.5], [60, 6.5], [40, 8.5], [20, 10.5], [6, 11]], { w: 0.7, color: '#1c1a10' });
        b.dot(103, -6.5, 1.6, 0.8, { color: '#141208' });
      });
      // tissue
      b.far = true;
      b.tube('tissue', [[652, 486], [668, 520], [676, 550]], [16, 11, 8]);
      b.shape('tissue', [[666, 548], [688, 550], [708, 560], [664, 562]]);
      b.tube('tissue', [[440, 486], [418, 520], [404, 550]], [18, 12, 9]);
      b.shape('tissue', [[394, 548], [420, 550], [444, 560], [392, 562]]);
      b.far = false;
      b.shape('tissue', [[690, 440], [640, 432], [580, 428], [520, 428], [460, 432], [420, 440], [380, 448], [330, 458], [270, 470], [210, 484], [150, 500], [100, 516], [60, 532], [50, 540], [70, 544], [120, 540], [180, 532], [240, 526], [300, 520], [360, 518], [410, 526], [460, 530], [520, 532], [580, 530], [640, 524], [690, 510], [720, 494], [740, 470]]);
      b.tube('tissue', [[636, 480], [612, 522], [626, 552]], [20, 13, 9], { edge: 0.7 });
      b.shape('tissue', [[616, 548], [642, 550], [666, 560], [612, 562]], { edge: 0.5 });
      b.shape('tissue', [[470, 450], [480, 500], [470, 524], [440, 520], [420, 490], [430, 456]], { edge: 0.7 });
      b.tube('tissue', [[470, 516], [452, 550]], [14, 11], { edge: 0.7 });
      b.shape('tissue', [[440, 548], [470, 552], [500, 560], [438, 562]], { edge: 0.5 });
    }
  });

  window.ANIMALS = A;
})();
