// Start-up. This file loads last, once every other script has defined its part.

Drawer.sync(); // draw the page around the cabinet for the locked state
requestAnimationFrame(loop); // start moving the cabinet (cabinet.js)
