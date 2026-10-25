/* 原版 MovieScene 插值与 FColor 颜色转换。 */
const TICKS = 24000;
const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
export const quantizeColor8 = x => Math.floor(clamp(x,0,1)*255.999)/255;
// UE4.26 的 MovieSceneColorTemplate 通过 ToFColor(true) 将线性颜色曲线写入 FColor。
export const encodeColor8 = x => {
    x=clamp(x,0,1);
    return quantizeColor8(x<=0.0031308?x*12.92:1.055*Math.pow(x,1/2.4)-0.055);
};
const bezier = (p,a,b,c,d) => {
    const q=1-p;
    return q*q*q*a+3*q*q*p*b+3*q*p*p*c+p*p*p*d;
};

// 紧凑格式保留每个 UE 关键帧的插值模式、斜率和切线权重。
export function curve(t,keys) {
    if (t<=keys[0][0]) return keys[0][1];
    for (let i=1;i<keys.length;i++) {
        const b=keys[i];
        if (t>b[0]) continue;
        if (t===b[0]) return b[1];
        const a=keys[i-1], duration=b[0]-a[0], p=(t-a[0])/duration;
        if (a[2]===1) return a[1];
        if (a[2]===0) return a[1]+(b[1]-a[1])*p;
        const weightedLeave=(a[7]&2)!==0, weightedArrive=(b[7]&1)!==0;
        if (weightedLeave || weightedArrive) {
            const seconds=duration/TICKS, leaveSlope=a[4]*TICKS, arriveSlope=b[3]*TICKS;
            const dx1=weightedLeave?a[6]/Math.hypot(1,leaveSlope):seconds/3;
            const dx2=weightedArrive?b[5]/Math.hypot(1,arriveSlope):seconds/3;
            let low=0,high=1;
            for (let j=0;j<20;j++) {
                const mid=(low+high)/2;
                if (bezier(mid,0,dx1,seconds-dx2,seconds)<p*seconds) low=mid; else high=mid;
            }
            return bezier((low+high)/2,a[1],a[1]+leaveSlope*dx1,b[1]-arriveSlope*dx2,b[1]);
        }
        const p2=p*p,p3=p2*p;
        return (2*p3-3*p2+1)*a[1]+(p3-2*p2+p)*duration*a[4]+(-2*p3+3*p2)*b[1]+(p3-p2)*duration*b[3];
    }
    return keys[keys.length-1][1];
}

