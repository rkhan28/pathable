/** Session flag: the landing's intro has played in this tab. */
export const INTRO_KEY = "pathable:intro";

/**
 * Runs inline in the root layout before first paint, but only acts on the
 * landing page itself (one path segment, the locale): it decides whether the
 * intro plays, so a repeat visit in the same session paints without it.
 * Kept out of intro.tsx because that is a client module, and a server layout
 * importing a string from it would get a client reference instead.
 */
export const introScript = `;try{var d=document.documentElement;if(location.pathname.split("/").filter(Boolean).length<=1){if(sessionStorage.getItem("${INTRO_KEY}"))d.dataset.intro="seen";else d.dataset.intro="play"}}catch(e){document.documentElement.dataset.intro="seen"}`;
