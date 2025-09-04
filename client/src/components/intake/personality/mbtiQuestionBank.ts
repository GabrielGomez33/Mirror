// src/components/intake/personality/mbtiQuestionBank.ts
import { likertScale7Point } from './scientificQuestionBank';

export interface MBTIQuestion {
  id: string;
  text: string;
  category: 'mbti';
  dimension: 'EI' | 'SN' | 'TF' | 'JP';
  direction: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
  facet?: string;
  options: {
    text: string;
    value: string;
    score: number;
  }[];
}

// MBTI Questions - 8 per dimension (32 total), balanced for each preference
export const mbtiQuestions: MBTIQuestion[] = [
  
  // ===== EXTRAVERSION vs INTROVERSION (8 items) =====
  {
    id: 'mbti-e1',
    text: 'I feel energized and recharged when spending time with groups of people',
    category: 'mbti',
    dimension: 'EI',
    direction: 'E',
    facet: 'energy_source',
    options: likertScale7Point
  },
  {
    id: 'mbti-e2',
    text: 'I enjoy being the center of attention in social situations',
    category: 'mbti',
    dimension: 'EI',
    direction: 'E',
    facet: 'social_comfort',
    options: likertScale7Point
  },
  {
    id: 'mbti-e3',
    text: 'I think out loud and process ideas by talking them through with others',
    category: 'mbti',
    dimension: 'EI',
    direction: 'E',
    facet: 'processing_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-e4',
    text: 'I prefer working in teams rather than working alone',
    category: 'mbti',
    dimension: 'EI',
    direction: 'E',
    facet: 'work_preference',
    options: likertScale7Point
  },
  
  // Introversion items
  {
    id: 'mbti-i1',
    text: 'I need quiet time alone to recharge after social interactions',
    category: 'mbti',
    dimension: 'EI',
    direction: 'I',
    facet: 'energy_source',
    options: likertScale7Point
  },
  {
    id: 'mbti-i2',
    text: 'I prefer to listen and observe rather than be the center of attention',
    category: 'mbti',
    dimension: 'EI',
    direction: 'I',
    facet: 'social_comfort',
    options: likertScale7Point
  },
  {
    id: 'mbti-i3',
    text: 'I prefer to think things through privately before sharing my ideas',
    category: 'mbti',
    dimension: 'EI',
    direction: 'I',
    facet: 'processing_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-i4',
    text: 'I am most productive when working independently with minimal interruptions',
    category: 'mbti',
    dimension: 'EI',
    direction: 'I',
    facet: 'work_preference',
    options: likertScale7Point
  },

  // ===== SENSING vs INTUITION (8 items) =====
  {
    id: 'mbti-s1',
    text: 'I focus on concrete facts and details rather than abstract possibilities',
    category: 'mbti',
    dimension: 'SN',
    direction: 'S',
    facet: 'information_focus',
    options: likertScale7Point
  },
  {
    id: 'mbti-s2',
    text: 'I prefer practical, hands-on learning over theoretical discussions',
    category: 'mbti',
    dimension: 'SN',
    direction: 'S',
    facet: 'learning_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-s3',
    text: 'I trust information that comes from direct experience and observation',
    category: 'mbti',
    dimension: 'SN',
    direction: 'S',
    facet: 'information_trust',
    options: likertScale7Point
  },
  {
    id: 'mbti-s4',
    text: 'I prefer step-by-step instructions and clear, specific guidelines',
    category: 'mbti',
    dimension: 'SN',
    direction: 'S',
    facet: 'instruction_preference',
    options: likertScale7Point
  },
  
  // Intuition items
  {
    id: 'mbti-n1',
    text: 'I am drawn to future possibilities and potential outcomes',
    category: 'mbti',
    dimension: 'SN',
    direction: 'N',
    facet: 'information_focus',
    options: likertScale7Point
  },
  {
    id: 'mbti-n2',
    text: 'I enjoy exploring theoretical concepts and abstract ideas',
    category: 'mbti',
    dimension: 'SN',
    direction: 'N',
    facet: 'learning_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-n3',
    text: 'I rely on hunches and gut feelings when making decisions',
    category: 'mbti',
    dimension: 'SN',
    direction: 'N',
    facet: 'information_trust',
    options: likertScale7Point
  },
  {
    id: 'mbti-n4',
    text: 'I prefer flexible guidelines that allow for creative interpretation',
    category: 'mbti',
    dimension: 'SN',
    direction: 'N',
    facet: 'instruction_preference',
    options: likertScale7Point
  },

  // ===== THINKING vs FEELING (8 items) =====
  {
    id: 'mbti-t1',
    text: 'I make decisions based primarily on logical analysis and objective criteria',
    category: 'mbti',
    dimension: 'TF',
    direction: 'T',
    facet: 'decision_basis',
    options: likertScale7Point
  },
  {
    id: 'mbti-t2',
    text: 'I value fairness and consistency over individual circumstances',
    category: 'mbti',
    dimension: 'TF',
    direction: 'T',
    facet: 'values_emphasis',
    options: likertScale7Point
  },
  {
    id: 'mbti-t3',
    text: 'I give direct, honest feedback even if it might hurt someone\'s feelings',
    category: 'mbti',
    dimension: 'TF',
    direction: 'T',
    facet: 'communication_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-t4',
    text: 'I am more interested in competence and efficiency than personal harmony',
    category: 'mbti',
    dimension: 'TF',
    direction: 'T',
    facet: 'priority_focus',
    options: likertScale7Point
  },
  
  // Feeling items
  {
    id: 'mbti-f1',
    text: 'I consider the impact on people and relationships when making decisions',
    category: 'mbti',
    dimension: 'TF',
    direction: 'F',
    facet: 'decision_basis',
    options: likertScale7Point
  },
  {
    id: 'mbti-f2',
    text: 'I believe individual circumstances should be considered over rigid rules',
    category: 'mbti',
    dimension: 'TF',
    direction: 'F',
    facet: 'values_emphasis',
    options: likertScale7Point
  },
  {
    id: 'mbti-f3',
    text: 'I am tactful and diplomatic when giving feedback to avoid hurting feelings',
    category: 'mbti',
    dimension: 'TF',
    direction: 'F',
    facet: 'communication_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-f4',
    text: 'I prioritize maintaining harmony and positive relationships with others',
    category: 'mbti',
    dimension: 'TF',
    direction: 'F',
    facet: 'priority_focus',
    options: likertScale7Point
  },

  // ===== JUDGING vs PERCEIVING (8 items) =====
  {
    id: 'mbti-j1',
    text: 'I prefer to have things planned and decided well in advance',
    category: 'mbti',
    dimension: 'JP',
    direction: 'J',
    facet: 'planning_preference',
    options: likertScale7Point
  },
  {
    id: 'mbti-j2',
    text: 'I like closure and feel unsettled when important matters are left unresolved',
    category: 'mbti',
    dimension: 'JP',
    direction: 'J',
    facet: 'closure_preference',
    options: likertScale7Point
  },
  {
    id: 'mbti-j3',
    text: 'I work steadily toward deadlines and rarely need last-minute pressure',
    category: 'mbti',
    dimension: 'JP',
    direction: 'J',
    facet: 'work_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-j4',
    text: 'I prefer structured environments with clear expectations and schedules',
    category: 'mbti',
    dimension: 'JP',
    direction: 'J',
    facet: 'environment_preference',
    options: likertScale7Point
  },
  
  // Perceiving items
  {
    id: 'mbti-p1',
    text: 'I prefer to keep my options open and adapt plans as I go',
    category: 'mbti',
    dimension: 'JP',
    direction: 'P',
    facet: 'planning_preference',
    options: likertScale7Point
  },
  {
    id: 'mbti-p2',
    text: 'I am comfortable with ambiguity and don\'t always need immediate answers',
    category: 'mbti',
    dimension: 'JP',
    direction: 'P',
    facet: 'closure_preference',
    options: likertScale7Point
  },
  {
    id: 'mbti-p3',
    text: 'I often work best under pressure and close to deadlines',
    category: 'mbti',
    dimension: 'JP',
    direction: 'P',
    facet: 'work_style',
    options: likertScale7Point
  },
  {
    id: 'mbti-p4',
    text: 'I thrive in flexible environments that allow for spontaneity and change',
    category: 'mbti',
    dimension: 'JP',
    direction: 'P',
    facet: 'environment_preference',
    options: likertScale7Point
  }
];

// MBTI Type descriptions with balanced, non-stereotypical language
export const mbtiTypeDescriptions: Record<string, string> = {
  'INTJ': 'The Architect - Strategic thinkers who enjoy developing long-term visions and systematic approaches to achieving complex goals.',
  'INTP': 'The Thinker - Analytical minds who love exploring theoretical possibilities and understanding how systems work.',
  'ENTJ': 'The Commander - Natural leaders who excel at organizing people and resources to achieve ambitious objectives.',
  'ENTP': 'The Debater - Innovative thinkers who enjoy exploring new ideas and challenging conventional approaches.',
  'INFJ': 'The Advocate - Insightful individuals who are driven by their values and desire to help others reach their potential.',
  'INFP': 'The Mediator - Idealistic souls who seek authenticity and meaning in their relationships and work.',
  'ENFJ': 'The Protagonist - People-focused leaders who inspire and motivate others toward positive change.',
  'ENFP': 'The Campaigner - Enthusiastic innovators who see potential in people and ideas and love bringing them together.',
  'ISTJ': 'The Logistician - Reliable individuals who value tradition, order, and systematic approaches to life.',
  'ISFJ': 'The Protector - Caring supporters who are dedicated to helping others and maintaining harmony.',
  'ESTJ': 'The Executive - Practical organizers who excel at managing projects and bringing order to complex situations.',
  'ESFJ': 'The Consul - Warm-hearted helpers who prioritize the needs of others and work to maintain social harmony.',
  'ISTP': 'The Virtuoso - Practical problem-solvers who enjoy working with their hands and understanding how things function.',
  'ISFP': 'The Adventurer - Gentle artists who value personal freedom and seek to live in accordance with their values.',
  'ESTP': 'The Entrepreneur - Energetic pragmatists who thrive on action and excel at adapting to immediate challenges.',
  'ESFP': 'The Entertainer - Spontaneous people-lovers who bring enthusiasm and joy to their interactions with others.'
};

// Preference strength descriptions
export const preferenceStrengthDescriptions = {
  'very strong': 'very clear',
  'strong': 'clear', 
  'moderate': 'moderate',
  'slight': 'slight',
  'unclear': 'unclear'
};

// MBTI Disclaimer
export const MBTI_DISCLAIMER = `
**About MBTI Assessment:**

The Myers-Briggs Type Indicator (MBTI) is a popular personality framework based on Carl Jung's psychological types. While widely used in personal development and workplace settings, it's important to understand its context:

**Strengths:**
• Provides useful vocabulary for discussing personality differences
• Can enhance self-awareness and communication
• Widely recognized and applied in various contexts
• Offers practical insights for personal and professional development

**Limitations:**
• Limited scientific validation compared to research-based models like the Big Five
• Type categories may oversimplify the complexity of personality
• Reliability can vary between test sessions
• Not recommended for high-stakes decisions (hiring, clinical diagnosis, etc.)

**Best Use:**
MBTI results are most valuable as a starting point for self-reflection and understanding different approaches to work, communication, and relationships. Consider them as general tendencies rather than fixed categories.
`;

export const mbtiMetadata = {
  totalQuestions: mbtiQuestions.length,
  questionsPerDimension: 8,
  dimensions: ['EI', 'SN', 'TF', 'JP'] as const,
  byDimension: {
    EI: mbtiQuestions.filter(q => q.dimension === 'EI').length,
    SN: mbtiQuestions.filter(q => q.dimension === 'SN').length,
    TF: mbtiQuestions.filter(q => q.dimension === 'TF').length,
    JP: mbtiQuestions.filter(q => q.dimension === 'JP').length,
  }
};

export default {
  mbtiQuestions,
  mbtiTypeDescriptions,
  preferenceStrengthDescriptions,
  MBTI_DISCLAIMER,
  mbtiMetadata
};
