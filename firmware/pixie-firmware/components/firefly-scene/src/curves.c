
// Fixed point maths and Various curve functions
// See: https://easings.net/


#include "firefly-curves.h"


static const fixed_ffxt FM_2      =    0x20000;
static const fixed_ffxt FM_10     =    0xa0000;
static const fixed_ffxt FM_20     =   0x140000;


fixed_ffxt FfxCurveLinear(fixed_ffxt t) { return t; }


fixed_ffxt FfxCurveEaseInSine(fixed_ffxt t) {
    // return 1.0f - cosf((t * M_PI) / 2.0f);
    return FM_1 - cosfx(mulfx(t, FM_PI) >> 1);
}

fixed_ffxt FfxCurveEaseOutSine(fixed_ffxt t) {
    // return sinf((t * M_PI) / 2.0f);
    return sinfx(mulfx(t, FM_PI) >> 1);
}

fixed_ffxt FfxCurveEaseInOutSine(fixed_ffxt t) {
    // return -(cosf(M_PI * t) - 1.0f) / 2.0f;
    return -(cosfx(mulfx(FM_PI, t) - FM_1) >> 1);
}


fixed_ffxt FfxCurveEaseInQuad(fixed_ffxt t) {
    // return t * t; 
    return mulfx(t, t);
}

fixed_ffxt FfxCurveEaseOutQuad(fixed_ffxt t) {
    // return 1.0f - (1.0f - t) * (1.0f - t);
    fixed_ffxt alpha1 = FM_1 - t;
    return FM_1 - mulfx(alpha1, alpha1);
}

fixed_ffxt FfxCurveEaseInOutQuad(fixed_ffxt t) {
    // return (t < 0.5f) ? 2.0f * t * t:
    //     1.0f - powf(-2.0 * t + 2.0f, 2.0f) / 2.0f;
    if (t < FM_1_2) { return mulfx(t, t) << 1; }
    fixed_ffxt alpha1 = -(t << 1) + FM_2;
    return FM_1 - (mulfx(alpha1, alpha1) >> 1);
}


fixed_ffxt FfxCurveEaseInCubic(fixed_ffxt t) {
    // return t * t * t;
    return mulfx(t, mulfx(t, t));
}

fixed_ffxt FfxCurveEaseOutCubic(fixed_ffxt t) {
    //return 1.0f - powf(1.0f - t, 3.0f);
    return FM_1 - FfxCurveEaseInCubic(FM_1 - t);

}

fixed_ffxt FfxCurveEaseInOutCubic(fixed_ffxt t) {
    // return (t < 0.5f) ? (4 * t * t * t): 1.0f - powf(-2.0f * t + 2.0f, 3.0f) / 2.0f;
    if (t < FM_1_2) { return FfxCurveEaseInCubic(t) << 2; }
    return FM_1 - (FfxCurveEaseInCubic(-(t << 1) + FM_2) >> 1);
}


fixed_ffxt FfxCurveEaseInQuart(fixed_ffxt t) {
    //return t * t * t * t;
    fixed_ffxt t2 = mulfx(t, t);
    return mulfx(t2, t2);
}

fixed_ffxt FfxCurveEaseOutQuart(fixed_ffxt t) {
    // return 1.0f - powf(1.0f - t, 4.0f);
    return FM_1 - FfxCurveEaseInQuart(FM_1 - t);
}

fixed_ffxt FfxCurveEaseInOutQuart(fixed_ffxt t) {
    // return (t < 0.5f) ? 8.0f * t * t * t * t: 1.0 - powf(-2.0f * t + 2.0f, 4.0f) / 2.0f;
    if (t < FM_1_2) { return FfxCurveEaseInQuart(t) << 3; }
    return FM_1 - (FfxCurveEaseInQuart(-(t << 1) + FM_2) >> 1);
}


fixed_ffxt FfxCurveEaseInQuint(fixed_ffxt t) {
    // return t * t * t * t * t;
    fixed_ffxt t2 = mulfx(t, t);
    return mulfx(t, mulfx(t2, t2));
}

fixed_ffxt FfxCurveEaseOutQuint(fixed_ffxt t) {
    // return 1.0f - powf(1.0f - t, 5);
    return FM_1 - FfxCurveEaseInQuint(FM_1 - t);
}

fixed_ffxt FfxCurveEaseInOutQuint(fixed_ffxt t) {
    // return (t < 0.5f) ? 16.0f * t * t * t * t * t: 1.0f - powf(-2.0f * t + 2.0f, 5.0f) / 2.0f;
    if (t < FM_1_2) {
        return FfxCurveEaseInQuint(t) << 4;
    }
    return FM_1 - (FfxCurveEaseInQuint(-(t << 1) + FM_2) >> 1);

}

fixed_ffxt FfxCurveEaseInExpo(fixed_ffxt t) {
    // return (t == 0.0f) ? 0.0f: powf(2.0f, 10.0f * t - 10.0f);
    if (t == 0) { return 0; }
    return powfx(FM_2, mulfx(FM_10, t - FM_10));
}

fixed_ffxt FfxCurveEaseOutExpo(fixed_ffxt t) {
    // return (t == 1.0f) ? 1.0f: 1.0f - powf(2.0f, -10.0f * t);
    if (t == FM_1) { return FM_1; }
    return FM_1 - powfx(FM_2, mulfx(-FM_10, t));
}

fixed_ffxt FfxCurveEaseInOutExpo(fixed_ffxt t) {
    // return (t == 0.0f) ? 0.0f:
    //     (t == 1.0f) ? 1.0f:
    //     (t < 0.5f) ? powf(2.0f, 20.0f * t - 10.0f) / 2.0f:
    //     (2.0f - powf(2.0f, -20.0f * t + 10.0f)) / 2.0f;
    if (t == 0) { return 0; }
    if (t == FM_1) { return FM_1; }
    if (t < FM_1_2) { return powfx(FM_2, mulfx(-FM_20, t) + FM_10) >> 1; }
    return (FM_2 - powfx(FM_2, mulfx(-FM_20, t) + FM_10)) >> 1;
}

// float FfxCurveEaseInCirc(float t) { return 1.0f - sqrtf(1.0f - powf(t, 2.0f)); }
// float FfxCurveEaseOutCirc(float t) { return sqrtf(1.0f - powf(t - 1.0f, 2.0f)); }
// float FfxCurveEaseInOutCirc(float t) {
//     return (t < 0.5f) ? (1.0f - sqrtf(1.0f - powf(2.0f * t, 2.0f))) / 2.0f:
//         (sqrtf(1.0f - powf(-2.0f * t + 2.0f, 2.0f)) + 1.0f) / 2.0f;
// }

fixed_ffxt FfxCurveEaseInBack(fixed_ffxt t) {
    // const float c1 = 1.70158f;
    // const float c3 = c1 + 1.0f;
    // return c3 * t * t * t - c1 * t * t;

    const fixed_ffxt c1 = 0x1b39b;
    const fixed_ffxt c3 = c1 + FM_1;
    const fixed_ffxt t2 = mulfx(t, t);
    return mulfx(mulfx(c3, t2), t) - mulfx(c1, t2);
}

fixed_ffxt FfxCurveEaseOutBack(fixed_ffxt t) {
    // const float c1 = 1.70158f;
    // const float c3 = c1 + 1.0f;

    // return 1.0f + c3 * powf(t - 1.0f, 3.0f) + c1 * powf(t - 1.0f, 2.0f);
    // float t_1 = t - 1.0f
    // return 1.0f + c3 * t_1 * t_1 * t_1 + c1 * t_1 * t_1;

    const fixed_ffxt c1 = 0x1b39b;
    const fixed_ffxt c3 = c1 + FM_1;
    const fixed_ffxt t_1 = t - FM_1;
    const fixed_ffxt t2 = mulfx(t_1, t_1);

    return FM_1 + mulfx(c3, mulfx(t_1, t2)) - mulfx(c1, t2);
}

// fixed_ffxt FfxCurveEaseInOutBack(fixed_ffxt t) {
    // return (t == 0.0f) ? 0.0f:
    //     (t == 1.0f) ? 1.0f:
    //     (t < 0.5f) ? powf(2.0, 20.0 * t - 10.0f) / 2.0f:
    //     (2.0f - powf(2.0, -20.0f * t + 10.0f)) / 2.0f;

//     if (t == 0) { return 0; }
//     if (t == 1) { return 1; }
//     if (tx < FixedHalf) {
//     }
// }

fixed_ffxt FfxCurveEaseInElastic(fixed_ffxt t) {
    // const float c4 = (2.0f * M_PI) / 3.0f;
    // return (t == 0.0f) ? 0.0f:
    //     (t == 1.0f) ? 1.0f:
    //     -powf(2.0f, 10.0f * t - 10.0f) * sinf((t * 10.0f - 10.75f) * c4);

    const fixed_ffxt c4 = 0x2182a;
    if (t == 0) { return 0; }
    if (t == 1) { return 1; }
    return -mulfx(powfx(FM_2, mulfx(FM_10, t) - FM_10), sinfx(mulfx(mulfx(FM_10, t) - 0xac000, c4)));
}

fixed_ffxt FfxCurveEaseOutElastic(fixed_ffxt t) {
    // const float c4 = (2 * M_PI) / 3;
    // return (t == 0) ? 0.0f:
    //     (t == 1) ? 1.0f:
    //     powf(2.0f, -10.0f * t) * sinf((t * 10.0f - 0.75f) * c4) + 1.0f;

    const fixed_ffxt c4 = 0x2182a;
    if (t == 0) { return 0; }
    if (t == 1) { return 1; }
    return mulfx(powfx(FM_2, mulfx(-FM_10, t)), sinfx(mulfx(mulfx(FM_10, t) - 0xc000, c4))) + FM_1;
}

// float FfxCurveEaseInOutElastic(float t) {
//     const float c5 = (2.0f * M_PI) / 4.5f;
//     return (t == 0.0f) ? 0.0f:
//         (t == 1.0f) ? 1.0f:
//         (t < 0.5f) ? -(powf(2.0f, 20.0f * t - 10.0f) * sinf((20.0f * t - 11.125f) * c5)) / 2.0f:
//         (pow(2.0f, -20.0f * t + 10.0f) * sinf((20.0f * t - 11.125f) * c5)) / 2.0f + 1.0f;
// }

fixed_ffxt FfxCurveEaseInBounce(fixed_ffxt t) {
    // return 1.0f - FfxCurveEaseOutBounce(1.0f - t);
    return FM_1 - FfxCurveEaseOutBounce(FM_1 - t);
}

fixed_ffxt FfxCurveEaseOutBounce(fixed_ffxt t) {
    // const float n1 = 7.5625f;
    // const float d1 = 2.75f;
    // if (t < 1.0f / d1) {
    //     return n1 * t * t;
    // } else if (t < 2.0f / d1) {
    //     return n1 * (t -= 1.5f / d1) * t + 0.75f;
    // } else if (t < 2.5f / d1) {
    //     return n1 * (t -= 2.25f / d1) * t + 0.9375f;
    // } else {
    //     return n1 * (t -= 2.625f / d1) * t + 0.984375f;
    // }

    const fixed_ffxt n1 = 0x78ff8;
    const fixed_ffxt d1 = 0x2bffd;
    const fixed_ffxt d1t = mulfx(d1, t);

    if (d1t < FM_1) { return mulfx(n1, mulfx(t, t)); }

    if (d1t < FM_2) {
        t -= (FM_1 + FM_1_2);
        return mulfx(n1 * t / d1, t) + 0xc000;
    }

    if (d1t < (FM_2 + FM_1_2)) {
        t -= (FM_2 + FM_1_4);
        return mulfx(n1 * t / d1, t) + 0xf000;
    }

    t -= 0x2a000;
    return mulfx(n1 * t / d1, t) + 0xfc00;

}

fixed_ffxt FfxCurveEaseInOutBounce(fixed_ffxt t) {
    // return t < 0.5f ? (1.0f - FfxCurveEaseOutBounce(1.0f - 2.0f * t)) / 2.0f:
    //     (1.0f + FfxCurveEaseOutBounce(2.0f * t - 1.0f)) / 2.0f;
    if (t < FM_1_2) { return (FM_1 - FfxCurveEaseOutBounce(FM_1 - (t << 1))) >> 1; }
    return (FM_1 + FfxCurveEaseOutBounce((t << 1) - FM_1)) >> 1;
}
