// Soft security - tidak merusak UI / tidak auto-refresh agresif
(function () {
  'use strict';
  try {
    document.addEventListener('contextmenu', function () {}, false);
    console.log('%cYanz Xiters Store', 'color:#ff1a3d;font-size:16px;font-weight:bold');
  } catch (e) {}
})();
