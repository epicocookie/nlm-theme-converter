// V8.1 polish fixes: restore the V7 typography users liked, improve Paper's
// Vietnamese serif coverage, and make the progress fill actually advance.

// Georgia can fall back per-glyph for Vietnamese diacritics on some systems,
// producing visibly inconsistent character sizes. Times New Roman keeps the
// warm Paper look while covering Vietnamese reliably on common desktop systems.
if (THEMES.paper) THEMES.paper.font = '"Times New Roman",Times,serif';

const v81BaseThemeCss = themeCss;
themeCss = function(theme) {
  return v81BaseThemeCss(theme) + `
    /* Restore V7 control typography. V8 accidentally made every button inherit
       the page/theme font, which changed option/hint/nav text in every theme. */
    button{font-family:Arial,"Helvetica Neue",sans-serif!important}
    .nlm-kebab,.nlm-review-link,.nlm-restart-link{font-family:var(--nlm-font)!important}

    /* Preserve the exporter's original math typography while keeping V8's
       content cleanup for broken \\text{...}/textXYZ artifacts. */
    .math,.math-block{font-family:"Cambria Math","Times New Roman",Times,serif!important;font-style:italic!important}
    .math-block{font-size:110%!important}
  `;
};

const v81BaseEnhancerScript = enhancerScript;
enhancerScript = function() {
  let code = v81BaseEnhancerScript();

  // V7 declared `.progress-fill { width: 0 !important }`, so normal inline
  // `style.width = ...` updates could never win the cascade. Set runtime widths
  // with matching priority so imported/theme CSS cannot pin the bar at zero.
  code = code.replace(
    "if (progressFill) progressFill.style.width = (((current + 1) / Math.max(total, 1)) * 100).toFixed(2) + '%';",
    "if (progressFill) progressFill.style.setProperty('width', (((current + 1) / Math.max(total, 1)) * 100).toFixed(2) + '%', 'important');"
  );
  code = code.replace(
    "if (progressFill) progressFill.style.width = '100%';",
    "if (progressFill) progressFill.style.setProperty('width', '100%', 'important');"
  );
  code = code.replace(
    "if (fill) fill.style.width = '0%';",
    "if (fill) fill.style.setProperty('width', '0%', 'important');"
  );

  return code;
};
