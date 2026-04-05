# Combat MVP Design

**Date:** 2026-04-05  
**Status:** Approved

## Overview

Add artillery combat: turret control, projectile firing, ground-impact explosions, area damage, and cooldown tracking. Units are tanks with a rotatable turret and elevatable barrel. Lua scripts control turret aim and firing. Height advantage is real — higher ground gives more range via physics.

## Data Model

### Unit additions
```
turretYaw: number       // radians, relative to hull yaw (0 = forward)
turretPitch: number     // radians, elevation (0 = flat, clamped to [0, 0.6])
fireCooldown: number    // seconds remaining before can fire again
turretMesh: THREE.Object3D | null   // GLB node for visual turret rotation
barrelMesh: THREE.Object3D | null   // GLB node for visual barrel pitch
```

### Projectile (src/projectiles.ts)
```
position: THREE.Vector3
velocity: THREE.Vector3
ownerTeam: Team
age: number   // seconds alive; removed after MAX_PROJECTILE_AGE
mesh: THREE.Mesh   // sphere visual
```

## Lua Interface

### New sensors added to self
```lua
self.turret_yaw    -- current turret yaw relative to hull (radians)
self.turret_pitch  -- current turret pitch (radians)
self.cooldown      -- seconds until ready to fire (0 = ready)
self.nearest_enemy -- { x, z, dist, health } or nil
```

### New actuators read from self after tick
```lua
self.turret_yaw    -- desired turret yaw (relative to hull, clamped [-π, π])
self.turret_pitch  -- desired turret pitch (clamped [0, 0.6])
self.fire          -- boolean, request to fire (ignored if cooldown > 0)
```

## ProjectileManager (src/projectiles.ts)

Owns all live projectiles. Called from Game's animate loop.

### fire(origin, worldYaw, worldPitch, ownerTeam, scene)
- Compute muzzle velocity vector: `vx = sin(worldYaw)*cos(pitch)*MUZZLE_VEL`, `vy = sin(pitch)*MUZZLE_VEL`, `vz = cos(worldYaw)*cos(pitch)*MUZZLE_VEL`
- Spawn sphere mesh at origin
- Push to projectiles array

### update(delta, terrain, units, scene)
For each live projectile:
1. `vel.y -= GRAVITY * delta`
2. `pos += vel * delta`
3. If `pos.y <= terrain.getHeightAt(pos.x, pos.z)`: explode and remove
4. If `age > MAX_PROJECTILE_AGE`: remove silently
5. Clamp Y to terrain to avoid going underground

### explode(pos, ownerTeam, units, scene)
- Remove projectile mesh
- Spawn expanding explosion sphere (scales 0→BLAST_RADIUS over 0.4s, fades opacity)
- For each unit within BLAST_RADIUS: apply `MAX_DAMAGE * max(0, 1 - dist/BLAST_RADIUS)` damage
- Friendly fire is OFF (skip ownerTeam units)

## Turret Visuals

On spawn, traverse modelRoot looking for Object3D with name matching `/turret/i`. Store as `turretMesh`. Similarly look for `/barrel/i` for pitch. If not found, no visual turret rotation — values still affect projectile direction.

Each frame in updateUnit:
```
turretMesh.rotation.y = unit.turretYaw
barrelMesh.rotation.x = -unit.turretPitch
```

## Default Firing Script

The DEFAULT_SCRIPT gains a firing section:
```lua
-- If nearest enemy is in range and turret is roughly aimed, fire
if self.nearest_enemy and self.nearest_enemy.dist < 60 then
  local dx = self.nearest_enemy.x - self.x
  local dz = self.nearest_enemy.z - self.z
  local world_bearing = math.atan(dx, dz)
  self.turret_yaw = world_bearing - self.yaw
  self.turret_pitch = 0.3   -- ~17° elevation
  if self.cooldown <= 0 then
    self.fire = true
  end
end
```

## Constants

| Constant | Value | Notes |
|---|---|---|
| FIRE_COOLDOWN | 5.0s | Seconds between shots |
| MUZZLE_VELOCITY | 40 m/s | Projectile launch speed |
| GRAVITY | 12 m/s² | Slightly faster than real for snappier feel |
| BLAST_RADIUS | 8 m | Area of effect radius |
| MAX_DAMAGE | 40 HP | Direct hit equivalent |
| MAX_PROJECTILE_AGE | 10s | Cleanup timeout |
| MAX_TURRET_PITCH | 0.6 rad | ~35° max elevation |

## Files Changed

- `src/units.ts` — Unit interface, spawn logic, updateUnit (turret visual + fire actuator), sensors
- `src/lua-behavior.ts` — UnitSensors, UnitActuators, tick() sensor injection
- `src/projectiles.ts` — New file: ProjectileManager, Projectile, explosion logic
- `src/game.ts` — Wire ProjectileManager into animate loop
