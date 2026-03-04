import { Vector3 } from './math.js';

export class Particle {
    constructor(mass, charge, position, velocity) {
        this.m = mass;       // 质量
        this.q = charge;     // 电荷量
        this.p = position;   // 位置 (Vector3)
        this.v = velocity;   // 速度 (Vector3)
    }

    // 辅助函数：根据当前速度，计算加速度 a = (q/m)(E + v × B)
    getAcceleration(v, E, B) {
        const vCrossB = v.cross(B);
        const E_plus_vCrossB = E.add(vCrossB);
        const F = E_plus_vCrossB.multiplyScalar(this.q);
        return F.multiplyScalar(1 / this.m);
    }

    // --- 【全新升级：四阶龙格-库塔算法 (RK4)】 ---
    update(dt, E, B) {
        // 步骤 1: 始点 (k1)
        const v1 = this.v;
        const a1 = this.getAcceleration(v1, E, B);
        const kv1 = a1.multiplyScalar(dt);
        const kp1 = v1.multiplyScalar(dt);

        // 步骤 2: 中点第一次估算 (k2)
        const v2 = this.v.add(kv1.multiplyScalar(0.5));
        const a2 = this.getAcceleration(v2, E, B);
        const kv2 = a2.multiplyScalar(dt);
        const kp2 = v2.multiplyScalar(dt);

        // 步骤 3: 中点第二次估算 (k3)
        const v3 = this.v.add(kv2.multiplyScalar(0.5));
        const a3 = this.getAcceleration(v3, E, B);
        const kv3 = a3.multiplyScalar(dt);
        const kp3 = v3.multiplyScalar(dt);

        // 步骤 4: 终点估算 (k4)
        const v4 = this.v.add(kv3);
        const a4 = this.getAcceleration(v4, E, B);
        const kv4 = a4.multiplyScalar(dt);
        const kp4 = v4.multiplyScalar(dt);

        // 汇总：加权平均更新速度和位置 (权重比例 1:2:2:1)
        const sum_kv = kv1.add(kv2.multiplyScalar(2)).add(kv3.multiplyScalar(2)).add(kv4);
        this.v = this.v.add(sum_kv.multiplyScalar(1.0 / 6.0));

        const sum_kp = kp1.add(kp2.multiplyScalar(2)).add(kp3.multiplyScalar(2)).add(kp4);
        this.p = this.p.add(sum_kp.multiplyScalar(1.0 / 6.0));
    }
}