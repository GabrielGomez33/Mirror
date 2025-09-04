// scientificQuestionBank.ts
// Comprehensive Big Five personality assessment with psychometric rigor

export interface Question {
  id: string;
  text: string;
  category: 'big5' | 'attention' | 'reflection';
  dimension: string;
  reverse?: boolean;
  facet?: string; // Specific sub-facet of the trait
  options: {
    text: string;
    value: string;
    score: number;
  }[];
}

// Human-friendly 7-point Likert scale
export const likertScale7Point = [
  { text: "Strongly disagree", value: "1", score: 1 },
  { text: "Disagree", value: "2", score: 2 },
  { text: "Somewhat disagree", value: "3", score: 3 },
  { text: "Neither agree nor disagree", value: "4", score: 4 },
  { text: "Somewhat agree", value: "5", score: 5 },
  { text: "Agree", value: "6", score: 6 },
  { text: "Strongly agree", value: "7", score: 7 }
];

// Scientific question bank with balanced design
export const scientificQuestions: Question[] = [
  // ===== OPENNESS TO EXPERIENCE (8 items: 4 regular, 4 reverse) =====
  {
    id: 'open-ideas',
    text: 'I enjoy exploring new ideas and concepts',
    category: 'big5',
    dimension: 'openness',
    facet: 'ideas',
    options: likertScale7Point
  },
  {
    id: 'open-aesthetics',
    text: 'I find beauty in art, music, or nature deeply moving',
    category: 'big5',
    dimension: 'openness',
    facet: 'aesthetics',
    options: likertScale7Point
  },
  {
    id: 'open-fantasy',
    text: 'I have a vivid imagination and enjoy daydreaming',
    category: 'big5',
    dimension: 'openness',
    facet: 'fantasy',
    options: likertScale7Point
  },
  {
    id: 'open-actions',
    text: 'I like to try new activities and visit new places',
    category: 'big5',
    dimension: 'openness',
    facet: 'actions',
    options: likertScale7Point
  },
  // Reverse-keyed openness items
  {
    id: 'open-routine-r',
    text: 'I prefer familiar routines over new experiences',
    category: 'big5',
    dimension: 'openness',
    reverse: true,
    facet: 'actions',
    options: likertScale7Point
  },
  {
    id: 'open-conventional-r',
    text: 'I think traditional approaches are usually best',
    category: 'big5',
    dimension: 'openness',
    reverse: true,
    facet: 'ideas',
    options: likertScale7Point
  },
  {
    id: 'open-practical-r',
    text: 'I focus on practical matters rather than abstract theories',
    category: 'big5',
    dimension: 'openness',
    reverse: true,
    facet: 'ideas',
    options: likertScale7Point
  },
  {
    id: 'open-simple-r',
    text: 'I prefer simple, straightforward activities',
    category: 'big5',
    dimension: 'openness',
    reverse: true,
    facet: 'actions',
    options: likertScale7Point
  },

  // ===== CONSCIENTIOUSNESS (8 items: 4 regular, 4 reverse) =====
  {
    id: 'cons-competence',
    text: 'I complete tasks successfully and efficiently',
    category: 'big5',
    dimension: 'conscientiousness',
    facet: 'competence',
    options: likertScale7Point
  },
  {
    id: 'cons-order',
    text: 'I keep my belongings neat and organized',
    category: 'big5',
    dimension: 'conscientiousness',
    facet: 'order',
    options: likertScale7Point
  },
  {
    id: 'cons-dutifulness',
    text: 'I honor my commitments and obligations',
    category: 'big5',
    dimension: 'conscientiousness',
    facet: 'dutifulness',
    options: likertScale7Point
  },
  {
    id: 'cons-achievement',
    text: 'I work hard to achieve my goals',
    category: 'big5',
    dimension: 'conscientiousness',
    facet: 'achievement',
    options: likertScale7Point
  },
  // Reverse-keyed conscientiousness items
  {
    id: 'cons-procrastinate-r',
    text: 'I often put off important tasks until the last minute',
    category: 'big5',
    dimension: 'conscientiousness',
    reverse: true,
    facet: 'self-discipline',
    options: likertScale7Point
  },
  {
    id: 'cons-disorganized-r',
    text: 'My personal space tends to be messy and disorganized',
    category: 'big5',
    dimension: 'conscientiousness',
    reverse: true,
    facet: 'order',
    options: likertScale7Point
  },
  {
    id: 'cons-careless-r',
    text: 'I sometimes make careless mistakes in my work',
    category: 'big5',
    dimension: 'conscientiousness',
    reverse: true,
    facet: 'competence',
    options: likertScale7Point
  },
  {
    id: 'cons-unreliable-r',
    text: 'People cannot always count on me to follow through',
    category: 'big5',
    dimension: 'conscientiousness',
    reverse: true,
    facet: 'dutifulness',
    options: likertScale7Point
  },

  // ===== EXTRAVERSION (8 items: 4 regular, 4 reverse) =====
  {
    id: 'extra-warmth',
    text: 'I enjoy meeting new people and making friends',
    category: 'big5',
    dimension: 'extraversion',
    facet: 'warmth',
    options: likertScale7Point
  },
  {
    id: 'extra-gregariousness',
    text: 'I feel comfortable in large groups of people',
    category: 'big5',
    dimension: 'extraversion',
    facet: 'gregariousness',
    options: likertScale7Point
  },
  {
    id: 'extra-assertiveness',
    text: 'I speak up and take charge in group situations',
    category: 'big5',
    dimension: 'extraversion',
    facet: 'assertiveness',
    options: likertScale7Point
  },
  {
    id: 'extra-activity',
    text: 'I like to stay busy and active',
    category: 'big5',
    dimension: 'extraversion',
    facet: 'activity',
    options: likertScale7Point
  },
  // Reverse-keyed extraversion items
  {
    id: 'extra-quiet-r',
    text: 'I prefer quiet, solitary activities',
    category: 'big5',
    dimension: 'extraversion',
    reverse: true,
    facet: 'gregariousness',
    options: likertScale7Point
  },
  {
    id: 'extra-reserved-r',
    text: 'I tend to be reserved and quiet in social situations',
    category: 'big5',
    dimension: 'extraversion',
    reverse: true,
    facet: 'assertiveness',
    options: likertScale7Point
  },
  {
    id: 'extra-drained-r',
    text: 'Large social gatherings drain my energy',
    category: 'big5',
    dimension: 'extraversion',
    reverse: true,
    facet: 'gregariousness',
    options: likertScale7Point
  },
  {
    id: 'extra-background-r',
    text: 'I prefer to stay in the background rather than draw attention',
    category: 'big5',
    dimension: 'extraversion',
    reverse: true,
    facet: 'assertiveness',
    options: likertScale7Point
  },

  // ===== AGREEABLENESS (8 items: 4 regular, 4 reverse) =====
  {
    id: 'agree-trust',
    text: 'I believe most people have good intentions',
    category: 'big5',
    dimension: 'agreeableness',
    facet: 'trust',
    options: likertScale7Point
  },
  {
    id: 'agree-altruism',
    text: 'I go out of my way to help others when they need it',
    category: 'big5',
    dimension: 'agreeableness',
    facet: 'altruism',
    options: likertScale7Point
  },
  {
    id: 'agree-compliance',
    text: 'I try to be cooperative and avoid conflicts',
    category: 'big5',
    dimension: 'agreeableness',
    facet: 'compliance',
    options: likertScale7Point
  },
  {
    id: 'agree-modesty',
    text: 'I am humble about my accomplishments',
    category: 'big5',
    dimension: 'agreeableness',
    facet: 'modesty',
    options: likertScale7Point
  },
  // Reverse-keyed agreeableness items
  {
    id: 'agree-suspicious-r',
    text: 'I am often suspicious of others\' motives',
    category: 'big5',
    dimension: 'agreeableness',
    reverse: true,
    facet: 'trust',
    options: likertScale7Point
  },
  {
    id: 'agree-competitive-r',
    text: 'I put my own interests before helping others',
    category: 'big5',
    dimension: 'agreeableness',
    reverse: true,
    facet: 'altruism',
    options: likertScale7Point
  },
  {
    id: 'agree-argumentative-r',
    text: 'I enjoy arguing my point of view',
    category: 'big5',
    dimension: 'agreeableness',
    reverse: true,
    facet: 'compliance',
    options: likertScale7Point
  },
  {
    id: 'agree-superior-r',
    text: 'I think I am better than most people',
    category: 'big5',
    dimension: 'agreeableness',
    reverse: true,
    facet: 'modesty',
    options: likertScale7Point
  },

  // ===== NEUROTICISM (8 items: 4 regular, 4 reverse) =====
  {
    id: 'neuro-anxiety',
    text: 'I worry about things that might go wrong',
    category: 'big5',
    dimension: 'neuroticism',
    facet: 'anxiety',
    options: likertScale7Point
  },
  {
    id: 'neuro-hostility',
    text: 'I get angry or frustrated easily',
    category: 'big5',
    dimension: 'neuroticism',
    facet: 'hostility',
    options: likertScale7Point
  },
  {
    id: 'neuro-depression',
    text: 'I often feel sad or down',
    category: 'big5',
    dimension: 'neuroticism',
    facet: 'depression',
    options: likertScale7Point
  },
  {
    id: 'neuro-vulnerability',
    text: 'I have trouble handling stress and pressure',
    category: 'big5',
    dimension: 'neuroticism',
    facet: 'vulnerability',
    options: likertScale7Point
  },
  // Reverse-keyed neuroticism items (emotional stability)
  {
    id: 'neuro-calm-r',
    text: 'I remain calm and composed under pressure',
    category: 'big5',
    dimension: 'neuroticism',
    reverse: true,
    facet: 'vulnerability',
    options: likertScale7Point
  },
  {
    id: 'neuro-relaxed-r',
    text: 'I am generally relaxed and laid-back',
    category: 'big5',
    dimension: 'neuroticism',
    reverse: true,
    facet: 'anxiety',
    options: likertScale7Point
  },
  {
    id: 'neuro-stable-r',
    text: 'My mood stays fairly stable from day to day',
    category: 'big5',
    dimension: 'neuroticism',
    reverse: true,
    facet: 'depression',
    options: likertScale7Point
  },
  {
    id: 'neuro-eventempered-r',
    text: 'I rarely get irritated or lose my temper',
    category: 'big5',
    dimension: 'neuroticism',
    reverse: true,
    facet: 'hostility',
    options: likertScale7Point
  },

  // ===== ATTENTION CHECKS (2 items) =====
  {
    id: 'attention-1',
    text: 'To help us ensure data quality, please select "Somewhat agree" for this question',
    category: 'attention',
    dimension: 'quality',
    options: likertScale7Point
  },
  {
    id: 'attention-2',
    text: 'For quality assurance purposes, please choose "Disagree" as your response',
    category: 'attention',
    dimension: 'quality',
    options: likertScale7Point
  },

  // ===== FINAL REFLECTION QUESTION =====
  {
    id: 'reflection-essence',
    text: 'Beyond what any test can measure, what makes you distinctly you? Share the values, experiences, quirks, or qualities that you feel capture your authentic self.',
    category: 'reflection',
    dimension: 'self_description',
    options: [
      { text: 'Open text response', value: 'text_input', score: 0 }
    ]
  }
];

// Question validation and metadata
export const questionMetadata = {
  totalQuestions: scientificQuestions.length,
  big5Questions: scientificQuestions.filter(q => q.category === 'big5').length,
  attentionChecks: scientificQuestions.filter(q => q.category === 'attention').length,
  reverseKeyed: scientificQuestions.filter(q => q.reverse).length,
  byTrait: {
    openness: scientificQuestions.filter(q => q.dimension === 'openness').length,
    conscientiousness: scientificQuestions.filter(q => q.dimension === 'conscientiousness').length,
    extraversion: scientificQuestions.filter(q => q.dimension === 'extraversion').length,
    agreeableness: scientificQuestions.filter(q => q.dimension === 'agreeableness').length,
    neuroticism: scientificQuestions.filter(q => q.dimension === 'neuroticism').length
  }
};

// Professional ethical disclaimer
export const PERSONALITY_DISCLAIMER = `
**Important Notice: This is a personality exploration tool for personal insight and entertainment purposes only.**

**Limitations:**
• This assessment is not a substitute for professional psychological evaluation
• Results should not be used for employment, clinical, or other high-stakes decisions
• Personality is complex and cannot be fully captured by any single assessment
• Your responses reflect your current self-perception, which may change over time

**Scientific Context:**
• Based on established Big Five personality research
• Uses psychometrically sound design principles
• Includes data quality controls and reliability estimates
• Results show confidence intervals to indicate measurement precision

**Professional Guidance:**
If you're seeking assessment for clinical, therapeutic, or important life decisions, please consult with a licensed mental health professional who can provide comprehensive evaluation using validated clinical instruments.
`;

export default {
  scientificQuestions,
  likertScale7Point,
  questionMetadata,
  PERSONALITY_DISCLAIMER
};
