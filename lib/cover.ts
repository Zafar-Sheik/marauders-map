import { FONTS, INK, INK_SOFT } from "./palette";
import { makeParchment } from "./parchment";
import { spaced } from "./render";

const CW = 1200, CH = 1600;

export function coverBlank() {
  return makeParchment(CW, CH, 1, [0.5], 31, true);
}

/** The outside of the folded map, once the oath has been sworn. */
export function coverInk() {
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(coverBlank(), 0, 0);
  const ink = document.createElement("canvas");
  ink.width = CW;
  ink.height = CH;
  const x = ink.getContext("2d")!;
  x.strokeStyle = INK;
  x.fillStyle = INK;
  x.lineWidth = 3;
  x.strokeRect(60, 60, CW - 120, CH - 120);
  x.lineWidth = 1.4;
  x.strokeRect(78, 78, CW - 156, CH - 156);
  x.textAlign = "center";
  x.textBaseline = "middle";

  const cx = CW / 2;
  x.font = `italic 58px ${FONTS.italic}`;
  x.fillText("Messrs", cx, 300);
  x.font = `76px ${FONTS.sc}`;
  spaced(x, "MOONY, WORMTAIL,", cx, 395, 4);
  spaced(x, "PADFOOT & PRONGS", cx, 485, 4);
  x.font = `italic 48px ${FONTS.italic}`;
  x.fillStyle = INK_SOFT;
  x.fillText("Purveyors of Aids to", cx, 600);
  x.fillText("Magical Mischief-Makers", cx, 660);
  x.fillText("are proud to present", cx, 760);
  x.fillStyle = INK;
  x.font = `118px ${FONTS.sc}`;
  spaced(x, "THE", cx, 900, 8);
  spaced(x, "MARAUDER'S", cx, 1020, 6);
  spaced(x, "MAP", cx, 1140, 8);

  // flourish
  x.lineWidth = 2.6;
  x.beginPath();
  x.moveTo(cx - 320, 1250);
  x.bezierCurveTo(cx - 160, 1200, cx - 80, 1300, cx, 1250);
  x.bezierCurveTo(cx + 80, 1200, cx + 160, 1300, cx + 320, 1250);
  x.stroke();
  // a little trail of footprints wandering off the cover
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const px = 220 + t * 760, py = 1400 - Math.sin(t * Math.PI) * 60;
    x.save();
    x.translate(px, py + (i % 2 ? 12 : -12));
    x.rotate(-Math.cos(t * Math.PI) * 0.3);
    x.beginPath();
    x.ellipse(8, 0, 13, 8, 0, 0, Math.PI * 2);
    x.ellipse(-14, 0, 6, 6.5, 0, 0, Math.PI * 2);
    x.globalAlpha = 0.35 + t * 0.6;
    x.fill();
    x.restore();
  }
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(ink, 0, 0);
  return c;
}
