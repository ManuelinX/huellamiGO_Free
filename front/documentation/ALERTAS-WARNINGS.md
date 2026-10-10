# ALERTAS / WARNINGS

## POSIBLE ERROR: VARIABLES DE FUENTE EN `:root`

Si se usan fuentes con `next/font/local` y la opcion `variable`, las clases generadas deben estar en el mismo nivel donde se resuelven los aliases CSS.

Caso que puede fallar:

```css
:root {
  --font-logo: var(--font-nunito, "Nunito Sans"), system-ui, sans-serif;
  --font-ui: var(--font-poppins, "Segoe UI"), system-ui, sans-serif;
  --font-title: var(--font-manrope, "Segoe UI"), system-ui, sans-serif;
}
```

Si las clases de `next/font` estan aplicadas al `body`, pero los aliases estan declarados en `:root`, `--font-nunito`, `--font-poppins` y `--font-manrope` pueden no existir cuando `:root` intenta resolverlos. En ese caso el navegador cae al fallback y parece que la fuente local no carga.

Solucion recomendada:

```jsx
<html className={`${nunito.variable} ${poppins.variable} ${manrope.variable}`}>
  <body>{children}</body>
</html>
```

Otra opcion valida es declarar los aliases de fuente en `body`, no en `:root`.

## WARNING: PESOS DE MANROPE

El archivo actual de Manrope esta declarado como rango `600 800`.

```js
const manrope = localFont({
  src: "../fonts/brand/manrope-latin-variable-600-800.woff2",
  weight: "600 800",
  variable: "--font-manrope",
});
```

Si algun elemento que usa `--font-title` pide `font-weight: 850`, `900` o `950`, el navegador puede simular o aproximar el peso porque esta fuera del rango disponible. Esto no significa que Manrope no cargue, pero puede verse distinto a lo esperado.

Opciones:

- Limitar esos pesos a `800` cuando usen Manrope.
- Usar Poppins para pesos `900`.
- Conseguir un archivo de Manrope con un rango que incluya pesos mas altos, si existe en el set usado.
