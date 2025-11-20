#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// ===================================
// I. FUNCIONES DE RUIDO Y HASH
// ===================================

vec2 hash22(vec2 p) {
    p = fract(p * vec2(5.3983, 5.4421));
    p += dot(p.xy, p.yx + 21.5351);
    return fract(p);
}

float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    
    float a = dot(hash22(i + vec2(0.0, 0.0)), vec2(1.0, 0.0));
    float b = dot(hash22(i + vec2(1.0, 0.0)), vec2(1.0, 0.0));
    float c = dot(hash22(i + vec2(0.0, 1.0)), vec2(1.0, 0.0));
    float d = dot(hash22(i + vec2(1.0, 1.0)), vec2(1.0, 0.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i=0; i<6; i++) {
        f += amp * noise2d(p);
        p *= 2.0; 
        amp *= 0.5;
    }
    return f;
}

float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// ===================================
// II. GEOMETRÍA SDF
// ===================================

mat3 rotateY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdPlane(vec3 p) {
    return p.y; 
}

struct Result {
    float dist;
    float id; // 1.0: Esfera, 2.0: Ladrillos
};

Result map(vec3 p) {
    float r = 0.5 + sin(u_time * 2.0) * 0.1;
    float sphere_dist = sdSphere(p - vec3(0.0, 1.0, 0.0), r); 
    
    float plane_dist = sdPlane(p);
    
    if (sphere_dist < plane_dist) {
        return Result(sphere_dist, 1.0); 
    } else {
        return Result(plane_dist, 2.0); 
    }
}

// ===================================
// III. RAYMARCHING Y NORMALES
// ===================================

vec3 calculateNormal(vec3 p) { 
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy).dist - map(p - e.xyy).dist,
        map(p + e.yxy).dist - map(p - e.yxy).dist,
        map(p + e.yyx).dist - map(p - e.yyx).dist
    ));
}

Result raymarch(vec3 ro, vec3 rd, float maxDist) {
    float totalDist = 0.0;
    float id = -1.0;
    
    for (int i = 0; i < 64; i++) {
        vec3 p = ro + rd * totalDist;
        Result res = map(p);
        
        if (res.dist < 0.001) {
            return Result(totalDist, res.id);
        }
        
        if (totalDist > maxDist) {
            break;
        }
        
        totalDist += res.dist;
        id = res.id;
    }
    return Result(-1.0, -1.0);
}

float calcShadow(vec3 p, vec3 light_dir, float tmax) {
    vec3 shadow_ro = p + light_dir * 0.01; 
    float totalDist = 0.0;
    
    for (int i = 0; i < 32; i++) { 
        vec3 current_p = shadow_ro + light_dir * totalDist;
        float d = map(current_p).dist;
        
        if (d < 0.001) return 0.0;
        
        totalDist += d;
        if (totalDist > tmax) break;
    }
    return 1.0;
}

vec3 applyFog(vec3 color, float dist) {
    const float FOG_DENSITY = 0.1; 
    float fog_amount = 1.0 - exp(-dist * FOG_DENSITY);
    vec3 fog_color = vec3(0.0);
    return mix(color, fog_color, fog_amount);
}

// ===================================
// IV. COLORACIÓN Y RELIEVE (LADRILLOS CON POM)
// ===================================

float getHeight(vec2 uv, vec2 brick_size) {
    vec2 pos = uv / brick_size; 
    float row = floor(pos.y);
    
    if (mod(row, 2.0) < 1.0) { 
        pos.x -= 0.5; 
    }
    
    vec2 f = fract(pos); 
    
    float border_thickness = 0.06; 
    float border_x = min(f.x, 1.0 - f.x);
    float border_y = min(f.y, 1.0 - f.y);

    float brick_shape = smoothstep(border_thickness, 0.0, min(border_x, border_y));
    
    float wear_noise = fbm(uv * 10.0) * 0.1; 
    
    return brick_shape + wear_noise * brick_shape; 
}

vec2 parallaxMapping(vec3 hit_pos_world, vec3 view_dir_world, vec2 uv_coords, vec2 brick_size, float height_scale) {
    vec3 view_dir_tangent = vec3(view_dir_world.x, view_dir_world.z, view_dir_world.y); 

    const int num_layers = 12; 
    float layer_depth = 1.0 / float(num_layers);
    
    float current_layer_depth = 0.0;
    vec2 current_uv_offset = vec2(0.0);
    float height_at_offset = 0.0;

    for(int i = 0; i < num_layers; i++) {
        current_uv_offset = view_dir_tangent.xy * current_layer_depth * height_scale;
        height_at_offset = getHeight(uv_coords + current_uv_offset, brick_size);
        current_layer_depth += layer_depth;
        
        if(height_at_offset < current_layer_depth) {
            break; 
        }
    }

    vec2 prev_uv_offset = current_uv_offset - view_dir_tangent.xy * layer_depth * height_scale;
    float after_height = height_at_offset - current_layer_depth; // Corregido: height_at_offset - current_layer_depth
    float before_height = getHeight(uv_coords + prev_uv_offset, brick_size) - (current_layer_depth - layer_depth);

    float weight = after_height / (after_height - before_height);
    vec2 final_uv_offset = mix(prev_uv_offset, current_uv_offset, weight);

    return uv_coords + final_uv_offset;
}

vec3 lighting(vec3 hit_pos, vec3 original_normal, vec3 rd, float object_id, vec3 light_dir) {
    vec3 material_color;
    float reflectivity = 0.0; 
    vec3 final_normal = original_normal; 
    
    vec2 uv_coords = hit_pos.xz;
    vec2 brick_size = vec2(1.0, 0.5); 

    if (object_id == 1.0) { // Esfera
        material_color = vec3(1.0, 1.0, 1.0); 
        reflectivity = 0.8;
    } else { // Plano (Ladrillos con POM)
        vec2 displaced_uv = parallaxMapping(hit_pos, rd, uv_coords, brick_size, 0.2); 
        
        float height_val = getHeight(displaced_uv, brick_size); 

        vec3 brick_cell_id = floor(displaced_uv / brick_size).xyx; 
        float random_color_offset = hash31(brick_cell_id) * 0.15; 
        
        vec3 mortar_color = vec3(0.6, 0.25, 0.1);    // Ladrillo naranja/rojizo más vivo
        vec3 brick_color_base = vec3(0.05, 0.05, 0.05); // Junta negra/gris muy oscura
        
        vec3 brick_color_varied = brick_color_base + random_color_offset;
        
        material_color = mix(mortar_color, brick_color_varied, height_val);
        reflectivity = 0.05; 

        // --- Normales para el relieve (Bump Mapping) ---
        vec2 e = vec2(0.001, 0.0);
        float h_center = getHeight(displaced_uv, brick_size);
        float h_x = getHeight(displaced_uv + e.xy, brick_size); 
        float h_y = getHeight(displaced_uv + e.yx, brick_size); 

        final_normal = normalize(original_normal + vec3(h_x - h_center, 0.0, h_y - h_center) * 2.0); 
    }

    float shadow = calcShadow(hit_pos, light_dir, 50.0); 

    float diff = max(dot(final_normal, light_dir), 0.0); 
    vec3 halfway_dir = normalize(light_dir - rd);
    float spec = pow(max(dot(final_normal, halfway_dir), 0.0), 32.0); 

    vec3 ambient = material_color * 0.1;
    vec3 diffuse_light = material_color * diff * 0.9 * shadow;
    vec3 specular_light = vec3(1.0) * spec * shadow;
    
    return ambient + diffuse_light + specular_light;
}

// ===================================
// V. FUNCIÓN PRINCIPAL
// ===================================

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st = st * 2.0 - 1.0; 
    st.x *= u_resolution.x / u_resolution.y; 
    
    vec3 ro = vec3(0.0, 1.0, -3.0); 
    ro = rotateY(u_time * 0.2) * ro;
    vec3 la = vec3(0.0, 0.5, 0.0);
    
    vec3 forward = normalize(la - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, forward));
    float fov = 1.0;
    vec3 rd = normalize(forward + right * st.x * fov + up * st.y * fov);
    
    vec3 light_dir = normalize(vec3(u_mouse.x / u_resolution.x * 2.0 - 1.0, 1.0, -1.0));
    
    vec3 final_color = vec3(0.0);
    Result res = raymarch(ro, rd, 50.0);
    float dist = res.dist; 

    if (dist > 0.0) {
        vec3 hit_pos = ro + rd * dist;
        vec3 normal_at_hit = calculateNormal(hit_pos); 
        float object_id = res.id;
        
        final_color = lighting(hit_pos, normal_at_hit, rd, object_id, light_dir);
        
        if (object_id == 1.0) { 
            vec3 reflected_rd = reflect(rd, normal_at_hit); 
            Result reflected_res = raymarch(hit_pos + normal_at_hit * 0.01, reflected_rd, 50.0);
            
            if (reflected_res.dist > 0.0) {
                vec3 reflected_hit_pos = hit_pos + normal_at_hit * 0.01 + reflected_rd * reflected_res.dist;
                vec3 reflected_normal_at_hit = calculateNormal(reflected_hit_pos); 
                
                vec3 reflected_color = lighting(reflected_hit_pos, reflected_normal_at_hit, reflected_rd, reflected_res.id, light_dir);
                
                float reflectivity = 0.8; 
                final_color = mix(final_color, reflected_color, reflectivity);
            }
        }
        
        final_color = applyFog(final_color, dist);
    }
    
    gl_FragColor = vec4(final_color, 1.0);
}