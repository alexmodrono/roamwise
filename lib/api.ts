declare const __ROAMWISE_STATIC__: boolean;
export const apiEnabled =
  typeof __ROAMWISE_STATIC__ === 'undefined' || !__ROAMWISE_STATIC__;
