export const CARD_W = 1024;
export const CARD_H = 648;
export const COMBINED_W = 1920;
export const COMBINED_H = 544;
export const PANEL_W = COMBINED_W / 2;
export const PANEL_H = COMBINED_H;

export const FONT = {
  labelSize: 13,
  bodySize: 30,
  boldSize: 32,
  smallSize: 10,
  fcnSize: 28,
  frontBodySize: 34,
  frontBoldSize: 34,
  backBoldSize: 35,
};

export const FRONT = {
  portrait: { x: 62, y: 165, w: 288, h: 420 },

  nameLabel: { x: 390, y: 190 },
  nameAmh: { x: 390, y: 225 },
  nameEng: { x: 390, y: 260 },

  dobLabel: { x: 390, y: 280 },
  dob: { x: 390, y: 340 },

  sexLabel: { x: 390, y: 338 },
  sex: { x: 390, y: 400 },

  expiryLabel: { x: 390, y: 395 },
  expiry: { x: 390, y: 480 },

  fcnBox: { x: 440, y: 520, w: 280, h: 91 },
  fcnNumY: 600,

  miniPortrait: { x: 780, y: 485, w: 120, h: 160 },

  issueEth: { x: 38, y: 530 },
  issueGreg: { x: 38, y: 255 },
};

export const BACK = {
  phoneLabel: { x: 85, y: 55 },
  phone: { x: 85, y: 95 },

  natLabel: { x: 85, y: 118 },
  natSelfLabel: { x: 85, y: 133 },
  nat: { x: 85, y: 190 },

  addrLabel: { x: 85, y: 210 },
  addrStartY: 260,
  addrLineH: 32,

  finLabel: { x: 130, y: 500 },
  finBox: { x: 195, y: 540, w: 180, h: 43 },
  fin: { x: 200, y: 560 },

  footer: { x: 30, y: 635 },
  snBox: { x: 825, y: 600, w: 199, h: 55 },
  snText: { x: 1000, y: 630 },

  qr: { x: 500, y: 20, w: 510, h: 560 },
};
