
#ifndef __FIREFLY_CURVES_H__
#define __FIREFLY_CURVES_H__

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */


#include <stdint.h>

#include "firefly-fixed.h"


/**
 *  Fixed-point curves
 *
 *  Each function takes a parametric value %%t%% and scales
 *  it to a new value based on the curve function.
 */

typedef fixed_ffxt (*FfxCurveFunc)(fixed_ffxt t);

fixed_ffxt FfxCurveLinear(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInSine(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutSine(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutSine(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInQuad(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutQuad(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutQuad(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInCubic(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutCubic(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutCubic(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInQuart(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutQuart(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutQuart(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInQuint(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutQuint(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutQuint(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInExpo(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutExpo(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutExpo(fixed_ffxt t);

fixed_ffxt FfxCurveEaseInBack(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutBack(fixed_ffxt t);
// fixed_ffxt CurveEaseInOutBack(fixed_ffxt t)

fixed_ffxt FfxCurveEaseInElastic(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutElastic(fixed_ffxt t);
// fixed_ffxt CurveEaseInOutElastic(fixed_ffxt t)

fixed_ffxt FfxCurveEaseInBounce(fixed_ffxt t);
fixed_ffxt FfxCurveEaseOutBounce(fixed_ffxt t);
fixed_ffxt FfxCurveEaseInOutBounce(fixed_ffxt t);


#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif /* __FIREFLY_CURVES_H__ */
