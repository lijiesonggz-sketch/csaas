/**
 * Compliance ROI Calculation Tests (Story 4.2 - Task 3.1)
 *
 * 纯函数测试，不依赖NestJS DI
 * 测试ROI计算公式和评分映射逻辑
 */

describe('Compliance ROI Calculation (Task 3.1)', () => {
  /**
   * ROI计算公式: (避免罚款 - 整改投入) / 整改投入
   * 评分映射: ROI>5→9-10分, 3-5→7-8分, 1-3→5-6分, <1→1-4分
   */

  // ✅ 实现ROI计算函数
  function calculateComplianceROI(solution: {
    estimatedCost: number
    expectedBenefit: number
  }): number {
    const { estimatedCost, expectedBenefit } = solution

    // 输入验证
    if (!estimatedCost || estimatedCost <= 0) {
      throw new Error('Invalid estimated cost')
    }

    // ROI计算
    const roi = (expectedBenefit - estimatedCost) / estimatedCost

    // ROI评分映射 (0-10)
    if (roi > 5) {
      return Math.min(10, 9 + (roi - 5)) // 9-10
    } else if (roi >= 3) {
      return Math.min(8, 7 + (roi - 3) * 2) // 7-8
    } else if (roi >= 1) {
      return Math.min(6, 5 + (roi - 1) * 2) // 5-6
    } else {
      return Math.max(1, roi * 4) // 1-4
    }
  }

  describe('ROI Calculation Formula', () => {
    it('should calculate ROI correctly for positive case', () => {
      // Arrange
      const solution = {
        name: '数据安全整改',
        estimatedCost: 500000, // 50万投入
        expectedBenefit: 2000000, // 避免罚款200万
      }

      // Act
      const roiScore = calculateComplianceROI(solution)

      // Assert
      // ROI = (200万 - 50万) / 50万 = 3
      // ROI 3进入3-5区间 → score = 7 + (3-3)*2 = 7
      expect(roiScore).toBe(7)
    })

    it('should calculate ROI correctly for negative case', () => {
      // Arrange
      const solution = {
        name: '低效益整改',
        estimatedCost: 1000000,
        expectedBenefit: 500000,
      }

      // Act
      const roiScore = calculateComplianceROI(solution)

      // Assert
      // ROI = (50万 - 100万) / 100万 = -0.5
      // ROI < 1 → score = max(1, -0.5*4) = max(1, -2) = 1
      expect(roiScore).toBe(1)
    })

    it('should calculate ROI for break-even case', () => {
      // Arrange
      const solution = {
        name: '保本方案',
        estimatedCost: 1000000,
        expectedBenefit: 1000000,
      }

      // Act
      const roiScore = calculateComplianceROI(solution)

      // Assert
      // ROI = (100万 - 100万) / 100万 = 0
      // ROI < 1 → score = max(1, 0*4) = 1
      expect(roiScore).toBe(1)
    })

    it('should calculate ROI for high benefit case', () => {
      // Arrange
      const solution = {
        name: '高效整改方案',
        estimatedCost: 100000, // 10万投入
        expectedBenefit: 1000000, // 避免罚款100万
      }

      // Act
      const roiScore = calculateComplianceROI(solution)

      // Assert
      // ROI = (100万 - 10万) / 10万 = 9
      // ROI > 5 → score = min(10, 9 + (9-5)) = min(10, 13) = 10
      expect(roiScore).toBe(10)
    })
  })

  describe('ROI Score Mapping', () => {
    it('should map ROI > 5 to score 9-10', () => {
      // Arrange
      const testCases = [
        { roi: 6, expectedScore: 10 }, // 9 + (6-5) = 10
        { roi: 10, expectedScore: 10 }, // min(10, 9+5) = 10
        { roi: 5.5, expectedScore: 9.5 }, // 9 + 0.5 = 9.5
      ]

      testCases.forEach(({ roi, expectedScore }) => {
        // Arrange
        const solution = {
          estimatedCost: 100000,
          expectedBenefit: 100000 + 100000 * roi,
        }

        // Act
        const score = calculateComplianceROI(solution)

        // Assert
        expect(score).toBe(expectedScore)
      })
    })

    it('should map ROI 3-5 to score 7-8', () => {
      // Arrange
      const testCases = [
        { cost: 100000, benefit: 400000, expectedScore: 7 }, // ROI=3
        { cost: 100000, benefit: 500000, expectedScore: 8 }, // ROI=4
        { cost: 100000, benefit: 600000, expectedScore: 8 }, // ROI=5
      ]

      testCases.forEach(({ cost, benefit, expectedScore }) => {
        // Arrange
        const solution = { estimatedCost: cost, expectedBenefit: benefit }

        // Act
        const score = calculateComplianceROI(solution)

        // Assert
        expect(score).toBe(expectedScore)
      })
    })

    it('should map ROI 1-3 to score 5-6', () => {
      // Arrange
      const testCases = [
        { cost: 100000, benefit: 200000, expectedScore: 5 }, // ROI=1
        { cost: 100000, benefit: 300000, expectedScore: 6 }, // ROI=2
        { cost: 100000, benefit: 350000, expectedScore: 6 }, // ROI=2.5
      ]

      testCases.forEach(({ cost, benefit, expectedScore }) => {
        // Arrange
        const solution = { estimatedCost: cost, expectedBenefit: benefit }

        // Act
        const score = calculateComplianceROI(solution)

        // Assert
        expect(score).toBe(expectedScore)
      })
    })

    it('should map ROI < 1 to score 1-4', () => {
      // Arrange
      const testCases = [
        { cost: 100000, benefit: 150000, expectedScore: 2 }, // ROI=0.5, 0.5*4=2
        { cost: 100000, benefit: 100000, expectedScore: 1 }, // ROI=0, max(1,0)=1
        { cost: 100000, benefit: 50000, expectedScore: 1 }, // ROI=-0.5, max(1,-2)=1
      ]

      testCases.forEach(({ cost, benefit, expectedScore }) => {
        // Arrange
        const solution = { estimatedCost: cost, expectedBenefit: benefit }

        // Act
        const score = calculateComplianceROI(solution)

        // Assert
        expect(score).toBe(expectedScore)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle very high ROI (> 10)', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: 2000000, // ROI = 19
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = 19 > 5 → score = min(10, 9 + 14) = 10
      expect(score).toBe(10) // 最多10分
    })

    it('should handle very low ROI (< -10)', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: -1000000, // ROI = -11
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = -11 < 1 → score = max(1, -11*4) = max(1, -44) = 1
      expect(score).toBe(1) // 最低1分
    })

    it('should handle boundary ROI = 5', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: 600000, // ROI = 5
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = 5进入3-5区间 → score = 7 + (5-3)*2 = 7+4 > 8, 限制为8
      expect(score).toBe(8)
    })

    it('should handle boundary ROI = 3', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: 400000, // ROI = 3
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = 3进入3-5区间 → score = 7 + (3-3)*2 = 7
      expect(score).toBe(7)
    })

    it('should handle boundary ROI = 1', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: 200000, // ROI = 1
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = 1进入1-3区间 → score = 5 + (1-1)*2 = 5
      expect(score).toBe(5)
    })
  })

  describe('Input Validation', () => {
    it('should throw error for zero cost', () => {
      // Arrange
      const solution = {
        estimatedCost: 0,
        expectedBenefit: 100000,
      }

      // Act & Assert
      expect(() => calculateComplianceROI(solution)).toThrow(
        'Invalid estimated cost',
      )
    })

    it('should throw error for negative cost', () => {
      // Arrange
      const solution = {
        estimatedCost: -100000,
        expectedBenefit: 100000,
      }

      // Act & Assert
      expect(() => calculateComplianceROI(solution)).toThrow(
        'Invalid estimated cost',
      )
    })

    it('should handle negative benefit (loss)', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: -50000,
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = (-5万 - 10万) / 10万 = -1.5
      // ROI < 1 → score = max(1, -1.5*4) = max(1, -6) = 1
      expect(score).toBe(1)
    })

    it('should handle very small positive cost', () => {
      // Arrange
      const solution = {
        estimatedCost: 1, // 1元
        expectedBenefit: 100000,
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = (10万 - 1) / 1 = 99999
      // ROI > 5 → score = min(10, 9+99994) = 10
      expect(score).toBe(10)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle typical compliance penalty avoidance', () => {
      // Arrange
      const solution = {
        estimatedCost: 200000, // 20万整改投入
        expectedBenefit: 500000, // 避免罚款50万
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = (50万 - 20万) / 20万 = 1.5
      // ROI 1-3区间 → score = 5 + (1.5-1)*2 = 6
      expect(score).toBe(6)
    })

    it('should handle high-cost compliance project', () => {
      // Arrange
      const solution = {
        estimatedCost: 1000000, // 100万整改投入
        expectedBenefit: 3000000, // 避免罚款300万
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = (300万 - 100万) / 100万 = 2
      // ROI 1-3区间 → score = min(6, 5 + (2-1)*2) = min(6, 7) = 6
      expect(score).toBe(6)
    })

    it('should handle low-cost quick win', () => {
      // Arrange
      const solution = {
        estimatedCost: 50000, // 5万整改投入
        expectedBenefit: 500000, // 避免罚款50万
      }

      // Act
      const score = calculateComplianceROI(solution)

      // Assert
      // ROI = (50万 - 5万) / 5万 = 9
      // ROI > 5 → score = min(10, 9+4) = 10
      expect(score).toBe(10)
    })
  })
})
