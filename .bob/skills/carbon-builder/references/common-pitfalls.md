# Common Pitfalls

## Web Components Styling

### 1) Incomplete SCSS imports

```scss
// Wrong
@use '@carbon/styles';
```

```scss
// Correct (minimal baseline)
@use '@carbon/styles/scss/reset';
@use '@carbon/styles/scss/type';
```

### 2) Missing app-entry style import

```js
// Correct: import styles before component imports
import './styles.scss';
import '@carbon/web-components/es/components/button/index.js';
```

### 3) Missing Carbon theme class on `<body>`

```html
<!-- Correct: keep existing Carbon theme class; default to cds--white when absent -->
<body class="cds--white"></body>
```

### 4) SCSS linked from HTML instead of entry module

```html
<!-- Wrong -->
<link rel="stylesheet" href="styles.scss">
```

```js
// Correct
import './styles.scss';
```
