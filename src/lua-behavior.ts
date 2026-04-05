import { LuaFactory, LuaEngine } from "wasmoon";

export const DEFAULT_SCRIPT = `\
function tick(self, dt)
  if self.target_x == nil then
    self.thrust = 0
    self.steer = 0
    return
  end

  local dx = self.target_x - self.x
  local dz = self.target_z - self.z
  local dist = math.sqrt(dx * dx + dz * dz)

  if dist < 0.5 then
    self.thrust = 0
    self.steer = 0
    return
  end

  local desired_yaw = math.atan(dx, dz)
  local angle_diff = desired_yaw - self.yaw
  while angle_diff >  math.pi do angle_diff = angle_diff - 2 * math.pi end
  while angle_diff < -math.pi do angle_diff = angle_diff + 2 * math.pi end

  self.steer  = math.max(-1, math.min(1, angle_diff * 2))
  self.thrust = math.max(0, math.cos(angle_diff))
end
`;

const SANDBOX_SCRIPT = `
io = nil
os = nil
require = nil
load = nil
dofile = nil
loadfile = nil
debug = nil
package = nil
print = nil
`;

export interface UnitSensors {
    x: number;
    z: number;
    yaw: number;
    moveCommand: { x: number; z: number } | null;
    turretYaw: number;
    turretPitch: number;
    fireCooldown: number;
    nearestEnemy: { x: number; z: number; dist: number; health: number } | null;
}

export interface UnitActuators {
    thrust: number;
    steer: number;
    turretYaw: number;
    turretPitch: number;
    fire: boolean;
    error?: string;
}

export interface UnitLuaEnv {
    engine: LuaEngine;
    tickFn: (...args: unknown[]) => Promise<unknown>;
}

export class LuaBehaviorEngine {
    private factory: LuaFactory | null = null;

    async init(): Promise<void> {
        this.factory = new LuaFactory();
    }

    async compile(script: string): Promise<UnitLuaEnv | Error> {
        if (!this.factory) throw new Error("LuaBehaviorEngine not initialized");

        const engine = await this.factory.createEngine();
        try {
            await engine.doString(SANDBOX_SCRIPT);
            await engine.doString(script);
            const tickFn = engine.global.get("tick");
            if (typeof tickFn !== "function") {
                engine.global.close();
                return new Error("Script must define a tick function");
            }
            return { engine, tickFn };
        } catch (e) {
            engine.global.close();
            return e instanceof Error ? e : new Error(String(e));
        }
    }

    async tick(env: UnitLuaEnv, sensors: UnitSensors, dt: number): Promise<UnitActuators> {
        const self: Record<string, unknown> = {
            x: sensors.x,
            z: sensors.z,
            yaw: sensors.yaw,
            thrust: 0,
            steer: 0,
            turret_yaw: sensors.turretYaw,
            turret_pitch: sensors.turretPitch,
            cooldown: sensors.fireCooldown,
            fire: false,
        };
        if (sensors.moveCommand !== null) {
            self.target_x = sensors.moveCommand.x;
            self.target_z = sensors.moveCommand.z;
        }
        if (sensors.nearestEnemy !== null) {
            self.nearest_enemy_x = sensors.nearestEnemy.x;
            self.nearest_enemy_z = sensors.nearestEnemy.z;
            self.nearest_enemy_dist = sensors.nearestEnemy.dist;
            self.nearest_enemy_health = sensors.nearestEnemy.health;
        }

        try {
            await env.tickFn(self, dt);
        } catch (e) {
            return {
                thrust: 0, steer: 0,
                turretYaw: sensors.turretYaw, turretPitch: sensors.turretPitch,
                fire: false, error: String(e),
            };
        }

        const thrust = Math.max(-1, Math.min(1, (self.thrust as number) ?? 0));
        const steer = Math.max(-1, Math.min(1, (self.steer as number) ?? 0));
        const turretYaw = Math.max(-Math.PI, Math.min(Math.PI,
            typeof self.turret_yaw === "number" ? self.turret_yaw : sensors.turretYaw));
        const turretPitch = Math.max(0, Math.min(0.6,
            typeof self.turret_pitch === "number" ? self.turret_pitch : sensors.turretPitch));
        const fire = self.fire === true;
        return { thrust, steer, turretYaw, turretPitch, fire };
    }

    destroyEnv(env: UnitLuaEnv): void {
        env.engine.global.close();
    }
}
