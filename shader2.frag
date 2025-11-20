precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution.xy;
    uv=uv*2.-1.;
    uv.x*=u_resolution.x/u_resolution.y;

    // Coordenadas 3D (Z es la "profundidad")
    vec3 p = vec3(uv, 1.0);
    
    // Rotación Z/Tiempo
    float a = u_time * 0.2;
    // La matriz de rotación 2D simplificada
    p.xy = p.xy * mat2(cos(a), sin(a), -sin(a), cos(a));

    // Mapeo Polar: Convierte (X, Y) a (Radio, Ángulo)
    float r = length(p.xy);
    float ang = atan(p.y, p.x);
    
    // Distorsión del ángulo con el tiempo y el radio para el efecto espiral
    ang += r * 5.0 + u_time * 0.5;

    // Patrón: Usamos el seno del ángulo distorsionado
    float d = sin(ang * 5.0); // 5.0 define el número de "brazos"
    
    // Animación de anillos viajando por el túnel
    d = mod(d + r * 2.0 - u_time * 0.8, 1.0);
    
    // Contraste para definir las líneas del túnel
    float c = smoothstep(0.4, 0.6, d);
    
    // Color: Tinte púrpura/magenta
    vec3 col = vec3(c);
    col.r = c * (0.5 + sin(u_time * 0.3) * 0.5);
    col.b = c * (0.8 + cos(u_time * 0.3) * 0.2);

    gl_FragColor = vec4(col,1.0);
}