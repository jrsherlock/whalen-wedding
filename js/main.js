import { initNavigation } from './navigation.js';
import { initAnimations } from './animations.js';
import { initAccordion } from './accordion.js';
import { initRSVP } from './rsvp.js';
import { initCandlelight } from './candlelight.js';
import { initGallery } from './gallery.js';
import { initLightbox } from './lightbox.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initCandlelight();
  initAnimations();
  initAccordion();
  initRSVP();
  initGallery();
  initLightbox();
});
