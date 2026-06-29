import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadOpenSans } from "@remotion/google-fonts/OpenSans";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadDMMono } from "@remotion/google-fonts/DMMono";

export const poppins = loadPoppins("normal", {
  weights: ["500", "600", "700"],
}).fontFamily;
export const openSans = loadOpenSans("normal", {
  weights: ["400", "600", "700"],
}).fontFamily;
export const fraunces = loadFraunces("normal", {
  weights: ["500", "600", "700"],
}).fontFamily;
export const dmMono = loadDMMono("normal", { weights: ["400", "500"] }).fontFamily;
