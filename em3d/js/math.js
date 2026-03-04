// 导出三维向量类
export class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // 向量加法
    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    // 标量乘法
    multiplyScalar(s) {
        return new Vector3(this.x * s, this.y * s, this.z * s);
    }

    // 叉乘 (计算洛伦兹力 v x B 必须用到)
    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }
}