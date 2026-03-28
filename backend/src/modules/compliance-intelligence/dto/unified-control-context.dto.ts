/**
 * Unified Control Context Protocol
 *
 * 所有消费控制点详情的业务接口必须在响应中暴露以下最小统一字段集。
 * 为后续 7.2（雷达）、7.3（报告）、7.4（审核）抽屉接入提供统一的数据契约。
 */

/**
 * 来源模块标识
 */
export type SourceModule = 'radar' | 'report' | 'audit';

/**
 * 匹配控制点引用
 */
export interface MatchedControlReference {
  /** 控制点 ID */
  controlId: string;
  /** 控制点名称 */
  controlName: string;
  /** 控制包来源 */
  packSource: string;
  /** 优先级 */
  priority: string;
}

/**
 * 统一控制点上下文协议
 *
 * 所有消费控制点详情的业务接口响应必须实现此接口
 */
export interface ControlContext {
  /**
   * 单控制点上下文的便捷字段，可为 null
   * 当有多个控制点时应为 null，以 matchedControls 为准
   */
  controlId: string | null;

  /**
   * 权威来源，始终存在，无匹配时为空数组 []
   */
  matchedControls: MatchedControlReference[];

  /**
   * 来源模块标识
   */
  sourceModule: SourceModule;

  /**
   * 来源记录 ID（用于详情页跳转回溯）
   */
  sourceRecordId: string;

  /**
   * 来源路由（相对路径格式，仅用于面包屑展示）
   * 前端不得自动导航到该路由而不做权限检查
   */
  sourceRoute?: string;
}

/**
 * 辅助函数：为单个控制点节点构造 MatchedControlReference 数组
 */
export function createSingleControlReference(
  controlId: string,
  controlName: string,
  packSource: string,
  priority: string,
): MatchedControlReference[] {
  return [
    {
      controlId,
      controlName,
      packSource,
      priority,
    },
  ];
}

/**
 * 辅助函数：创建空控制点引用数组
 */
export function createEmptyControlReference(): MatchedControlReference[] {
  return [];
}
