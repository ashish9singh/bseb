
(function () {
  "use strict";

  var path = window.location.pathname;

  // Redirect only URLs ending in .html.
  if (/\.html$/i.test(path)) {
    var cleanPath = path.replace(/\.html$/i, "/");

    // Prevent a redirect loop.
    if (cleanPath !== path) {
      window.location.replace(
        cleanPath + window.location.search + window.location.hash
      );
    }
  }
})();
