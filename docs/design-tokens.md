# Design tokens

The Figma exports in `src/styles/design-tokens/source/` are the source files for the app's design tokens. The generated `src/styles/design-tokens.css` provides palette, semantic light and dark theme, typography, dimension, and border-width custom properties. `src/styles/globals.css` maps the semantic color tokens to the names used by Tailwind and the existing components.

After changing any source token JSON, regenerate the CSS with:

```sh
npm run tokens:build
```

The generated file is committed with its source JSON so the app can use the tokens directly. Keep the interface font stack on the system font and the editor font stack on Figtree when regenerating or extending the token mapping.

Typography and dimension tokens use the desktop values by default, tablet values at widths up to 768px, and mobile values at widths up to 640px. The mobile rule takes precedence at widths up to 640px.
