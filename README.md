# Shaders-IG-ULPGC

# 🧵 Shader GLSL — Raymarching + POM + Iluminación

## 📌 Descripción
Este proyecto contiene un **fragment shader GLSL** que renderiza una escena 3D mediante **raymarching**, combinando:
- Geometría SDF (esfera + plano).
- Iluminación dinámica con sombras.
- Parallax Occlusion Mapping (POM) para ladrillos.
- Reflexiones en la esfera.
- Ruido FBM para desgaste.
- Fog atmosférico.

Todo el efecto se genera **dentro del fragment shader**, sin texturas externas.

---

## 🧩 Componentes Principales

### 1. Ruido y Hash
Funciones de hash, ruido básico y FBM para:
- Variación de color.
- Desgaste en ladrillos.
- Relieve con POM.

### 2. Geometría SDF
- `sdSphere()` → esfera animada en tamaño.
- `sdPlane()` → plano del suelo.
- `map()` → retorna distancia + ID del objeto.

### 3. Raymarching
- `raymarch()` recorre la escena por distancias SDF.
- `calculateNormal()` calcula normales por derivación.
- `calcShadow()` crea sombras suaves.

### 4. Materiales y POM
El plano usa ladrillos generados por:
- `getHeight()` → mapa de altura procedural.
- `parallaxMapping()` → POM por capas.
- Iluminación con variación aleatoria por ladrillo.

La esfera:
- Tiene color blanco.
- Recibe luz especular.
- Incluye reflexión secundaria vía raymarching.

### 5. Iluminación
Modelo de iluminación:
- Ambiente
- Difusa
- Especular
- Sombras dinámicas

La luz responde a la posición del ratón.

### 6. Fog
Fog exponencial para profundidad y atmósfera.

### 7. Función Principal
- Construcción de la cámara.
- Raymarch de la escena.
- Cálculo de impactos y normales.
- Iluminación según ID del objeto.
- Reflexiones (esfera).
- Fog.
- Output final en `gl_FragColor`.

---

## ▶️ Uniforms necesarios
```glsl
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
