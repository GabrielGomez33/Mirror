// src/components/intake/PersonalityStep.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntake } from '../../context/IntakeContext';
import GlassCard, { GlassButton, GlassProgress } from '../ui/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import BasicScene from '../three/BasicScene';

// Types
interface Question {
  id: string;
  text: string;
  category: 'big5' | 'mbti';
  dimension: string;
  options: {
    text: string;
    value: string;
    score: number;
  }[];
}

interface PersonalityScores {
  big5: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  mbti: {
    E: number;
    I: number;
    S: number;
    N: number;
    T: number;
    F: number;
    J: number;
    P: number;
  };
}

interface PersonalityResult {
  big5Profile: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  mbtiType: string;
  dominantTraits: string[];
  description: string;
}

// ---
// Question Bank - All Variants
// ---

const questionsVariant1: Question[] = [
  // Big 5 Questions (15 questions)
  {
    id: 'b5-1-1',
    text: 'When starting a new project, you are typically...',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Eager to plan every detail and set clear goals', value: 'high', score: 5 },
      { text: 'Ready to start, but adapt the plan as you go', value: 'medium', score: 3 },
      { text: 'Happy to improvise and see where it leads', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-2',
    text: 'How do you usually react to unexpected changes?',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Embrace them as exciting opportunities', value: 'high', score: 5 },
      { text: 'Adjust with some initial hesitation', value: 'medium', score: 3 },
      { text: 'Prefer things to stay as planned', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-3',
    text: 'In social gatherings, you often find yourself...',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Being the center of attention and initiating conversations', value: 'high', score: 5 },
      { text: 'Enjoying conversations with small groups', value: 'medium', score: 3 },
      { text: 'Preferring to observe rather than participate actively', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-4',
    text: 'When collaborating with others, your natural tendency is to...',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Prioritize harmony and compromise to keep everyone happy', value: 'high', score: 5 },
      { text: 'Cooperate, but ensure your own ideas are considered', value: 'medium', score: 3 },
      { text: 'Challenge ideas to ensure the best outcome, even if it causes friction', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-5',
    text: 'How do you generally handle stressful situations?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Become easily worried and overwhelmed', value: 'high', score: 5 },
      { text: 'Feel some stress but manage to cope effectively', value: 'medium', score: 3 },
      { text: 'Remain calm and composed under pressure', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-6',
    text: 'When faced with a complex problem, you prefer to...',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Brainstorm many creative and unconventional solutions', value: 'high', score: 5 },
      { text: 'Consider standard approaches first, then explore alternatives', value: 'medium', score: 3 },
      { text: 'Stick to proven methods and practical solutions', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-7',
    text: 'How punctual are you typically for appointments?',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Always early or precisely on time', value: 'high', score: 5 },
      { text: 'Usually on time, occasionally a few minutes late', value: 'medium', score: 3 },
      { text: 'Often late, valuing flexibility over strict schedules', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-8',
    text: 'After a busy week, you feel most refreshed by...',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Going out with friends and being active', value: 'high', score: 5 },
      { text: 'A mix of social time and personal reflection', value: 'medium', score: 3 },
      { text: 'Spending quiet time alone or with close family', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-9',
    text: 'When someone criticizes your work, you tend to...',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Take it personally and feel hurt', value: 'high', score: 5 },
      { text: 'Consider the feedback and make improvements', value: 'medium', score: 3 },
      { text: 'Defend your work and challenge the criticism', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-10',
    text: 'How often do you worry about the future?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Frequently, often anticipating potential problems', value: 'high', score: 5 },
      { text: 'Sometimes, but you try to stay positive', value: 'medium', score: 3 },
      { text: 'Rarely, you take things as they come', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-11',
    text: 'You are most drawn to people who are...',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Intellectually curious and open to new ideas', value: 'high', score: 5 },
      { text: 'Balanced, with both practical and imaginative qualities', value: 'medium', score: 3 },
      { text: 'Down-to-earth and pragmatic', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-12',
    text: 'When you commit to a task, how likely are you to follow through?',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Always, even if it requires extra effort', value: 'high', score: 5 },
      { text: 'Usually, but sometimes other priorities arise', value: 'medium', score: 3 },
      { text: 'Only if it remains interesting or convenient', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-13',
    text: 'You prefer conversations that are...',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Lively and cover a wide range of topics', value: 'high', score: 5 },
      { text: 'Meaningful and focus on shared interests', value: 'medium', score: 3 },
      { text: 'Calm and allow for deep reflection', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-14',
    text: 'If a friend needs help, you usually...',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Go out of your way to assist them', value: 'high', score: 5 },
      { text: 'Offer help if you can easily fit it into your schedule', value: 'medium', score: 3 },
      { text: 'Expect them to figure things out themselves', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-1-15',
    text: 'How easily do you get flustered by small inconveniences?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Quite easily; they can ruin your day', value: 'high', score: 5 },
      { text: 'Somewhat, but you quickly recover', value: 'medium', score: 3 },
      { text: 'Rarely; you shrug them off', value: 'low', score: 1 }
    ]
  },

  // MBTI Questions (15 questions)
  {
    id: 'mbti-1-1',
    text: 'When making a decision, you are more influenced by:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Objective facts and logical reasoning', value: 'T', score: 1 },
      { text: 'Your personal values and impact on people', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-1-2',
    text: 'You prefer to focus on:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'The realities of the present moment', value: 'S', score: 1 },
      { text: 'Future possibilities and underlying meanings', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-1-3',
    text: 'When you are with a group of people, you typically:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Do most of the talking', value: 'E', score: 1 },
      { text: 'Listen more than you talk', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-1-4',
    text: 'You prefer to:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Plan things well in advance', value: 'J', score: 1 },
      { text: 'Be spontaneous and adapt as you go', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-1-5',
    text: 'When describing things, you tend to be:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'Literal and factual', value: 'S', score: 1 },
      { text: 'Figurative and metaphorical', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-1-6',
    text: 'You feel more comfortable when:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Decisions are based on principles and consistency', value: 'T', score: 1 },
      { text: 'Decisions consider individual circumstances and empathy', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-1-7',
    text: 'At a party, you are more likely to:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Start conversations with many different people', value: 'E', score: 1 },
      { text: 'Talk in depth with a few people you know well', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-1-8',
    text: 'You are more inclined to:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Complete tasks before relaxing', value: 'J', score: 1 },
      { text: 'Relax before completing tasks', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-1-9',
    text: 'When solving problems, you rely more on:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'Practical experience and what is observable', value: 'S', score: 1 },
      { text: 'Hunches and inspirations', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-1-10',
    text: 'You are more often seen as:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Fair-minded and reasonable', value: 'T', score: 1 },
      { text: 'Tender-hearted and sympathetic', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-1-11',
    text: 'After a day of interacting with many people, you feel:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Energized and ready for more', value: 'E', score: 1 },
      { text: 'Drained and need time to recharge alone', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-1-12',
    text: 'When working on a project, you prefer to:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Establish deadlines and work steadily towards them', value: 'J', score: 1 },
      { text: 'Work in bursts and be flexible with deadlines', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-1-13',
    text: 'You are more interested in:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'How things are similar to past experiences', value: 'S', score: 1 },
      { text: 'How things could be different in the future', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-1-14',
    text: 'When giving feedback, you tend to be:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Direct and honest, even if it’s difficult to hear', value: 'T', score: 1 },
      { text: 'Tactful and gentle, considering the other person’s feelings', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-1-15',
    text: 'When choosing a vacation, you typically:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Have a detailed itinerary mapped out', value: 'J', score: 1 },
      { text: 'Decide on the fly and explore new things', value: 'P', score: 1 }
    ]
  },
];

const questionsVariant2: Question[] = [
  // Big 5 Questions (15 questions)
  {
    id: 'b5-2-1',
    text: 'When facing a challenging task, your initial approach is to...',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Break it down into manageable steps and follow a plan', value: 'high', score: 5 },
      { text: 'Start working and figure out the steps as you go', value: 'medium', score: 3 },
      { text: 'Feel overwhelmed and put it off until the last minute', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-2',
    text: 'You are most excited by:',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Exploring complex theories and abstract concepts', value: 'high', score: 5 },
      { text: 'Learning practical skills and useful information', value: 'medium', score: 3 },
      { text: 'Routines and familiar activities', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-3',
    text: 'How do you generally feel about meeting new people?',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Excited and look forward to expanding your social circle', value: 'high', score: 5 },
      { text: 'Cautiously optimistic, open to new connections', value: 'medium', score: 3 },
      { text: 'A bit anxious or prefer to stick with familiar faces', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-4',
    text: 'When an argument arises, you are most likely to:',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Seek common ground and try to de-escalate the situation', value: 'high', score: 5 },
      { text: 'Express your opinion, but also listen to others', value: 'medium', score: 3 },
      { text: 'Stand firm on your beliefs, even if it leads to conflict', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-5',
    text: 'How easily do you get upset by criticism?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Very easily; it can impact your mood significantly', value: 'high', score: 5 },
      { text: 'Somewhat, but you can usually brush it off after a while', value: 'medium', score: 3 },
      { text: 'Not easily; you see it as an opportunity for growth', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-6',
    text: 'Your living space is typically:',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Neat and orderly, everything has its place', value: 'high', score: 5 },
      { text: 'Reasonably tidy, but with occasional messiness', value: 'medium', score: 3 },
      { text: 'Cluttered and disorganized, but you know where everything is', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-7',
    text: 'You are more inclined to try new and exotic foods:',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Always, the more unusual the better!', value: 'high', score: 5 },
      { text: 'Sometimes, if they look appealing', value: 'medium', score: 3 },
      { text: 'Rarely, preferring familiar dishes', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-8',
    text: 'When working in a team, you prefer to:',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Take on a leadership role and direct the group', value: 'high', score: 5 },
      { text: 'Contribute actively and supportively', value: 'medium', score: 3 },
      { text: 'Work independently or in a smaller, focused role', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-9',
    text: 'You believe most people are inherently:',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Good and trustworthy', value: 'high', score: 5 },
      { text: 'A mix of good and bad, depending on circumstances', value: 'medium', score: 3 },
      { text: 'Self-serving and should be approached with caution', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-10',
    text: 'When something goes wrong, you tend to:',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Dwell on it and feel negative emotions', value: 'high', score: 5 },
      { text: 'Acknowledge it, but then try to move on', value: 'medium', score: 3 },
      { text: 'Quickly find a solution and don’t let it bother you', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-11',
    text: 'How important is artistic expression to you?',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Very important; you enjoy creating or appreciating art', value: 'high', score: 5 },
      { text: 'Moderately important; you appreciate it occasionally', value: 'medium', score: 3 },
      { text: 'Not very important; you prefer practical pursuits', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-12',
    text: 'You are known for your:',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Reliability and strong sense of duty', value: 'high', score: 5 },
      { text: 'Adaptability and willingness to adjust plans', value: 'medium', score: 3 },
      { text: 'Spontaneity and easygoing nature', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-13',
    text: 'When you have free time, you often spend it:',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Engaging in social activities and meeting new people', value: 'high', score: 5 },
      { text: 'Pursuing hobbies alone or with a close friend', value: 'medium', score: 3 },
      { text: 'Relaxing quietly at home', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-14',
    text: 'If someone is in distress, your first impulse is to:',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Offer comfort and practical help', value: 'high', score: 5 },
      { text: 'Offer advice or try to understand the situation', value: 'medium', score: 3 },
      { text: 'Give them space to sort it out themselves', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-2-15',
    text: 'How do you typically react to setbacks?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Become disheartened and lose motivation', value: 'high', score: 5 },
      { text: 'Feel frustrated but quickly look for solutions', value: 'medium', score: 3 },
      { text: 'See them as temporary obstacles and remain optimistic', value: 'low', score: 1 }
    ]
  },

  // MBTI Questions (15 questions)
  {
    id: 'mbti-2-1',
    text: 'You prefer to communicate by:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Talking things through out loud', value: 'E', score: 1 },
      { text: 'Thinking things through internally', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-2-2',
    text: 'When learning a new skill, you prefer:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'Step-by-step instructions and hands-on practice', value: 'S', score: 1 },
      { text: 'To grasp the underlying principles and theories', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-2-3',
    text: 'You tend to make decisions based on:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Logical consequences and objective criteria', value: 'T', score: 1 },
      { text: 'Personal values and the impact on people', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-2-4',
    text: 'Your approach to life is generally more:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Organized and structured', value: 'J', score: 1 },
      { text: 'Flexible and adaptable', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-2-5',
    text: 'You are more interested in:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'The specific details and facts', value: 'S', score: 1 },
      { text: 'The patterns and connections between things', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-2-6',
    text: 'When giving a gift, you prioritize:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Its practical usefulness', value: 'T', score: 1 },
      { text: 'Its thoughtfulness and sentiment', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-2-7',
    text: 'When attending an event, you generally:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Enjoy being in the midst of the action', value: 'E', score: 1 },
      { text: 'Prefer a quieter spot, observing from the sidelines', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-2-8',
    text: 'You prefer to:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Have a clear agenda for meetings', value: 'J', score: 1 },
      { text: 'Let meetings flow organically', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-2-9',
    text: 'When discussing ideas, you focus more on:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'How they can be implemented in reality', value: 'S', score: 1 },
      { text: 'Their potential and theoretical implications', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-2-10',
    text: 'You are more inclined to trust:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Your head (logic and reason)', value: 'T', score: 1 },
      { text: 'Your heart (emotions and values)', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-2-11',
    text: 'How do you prepare for an upcoming event?',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'By making a detailed checklist and sticking to it', value: 'J', score: 1 },
      { text: 'By keeping your options open and dealing with things as they arise', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-2-12',
    text: 'When meeting new people, you tend to:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Introduce yourself and start conversations easily', value: 'E', score: 1 },
      { text: 'Wait for others to approach you', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-2-13',
    text: 'You are more drawn to:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'What is concrete and tangible', value: 'S', score: 1 },
      { text: 'What is abstract and symbolic', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-2-14',
    text: 'When making choices, you value:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Consistency and fairness above all', value: 'T', score: 1 },
      { text: 'Harmony and maintaining good relationships', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-2-15',
    text: 'Your personal style is more:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Structured and decisive', value: 'J', score: 1 },
      { text: 'Open-ended and curious', value: 'P', score: 1 }
    ]
  },
];

const questionsVariant3: Question[] = [
  // Big 5 Questions (15 questions)
  {
    id: 'b5-3-1',
    text: 'How organized is your personal filing system (digital or physical)?',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Highly organized, with a clear system for everything', value: 'high', score: 5 },
      { text: 'Generally organized, but sometimes things get misplaced', value: 'medium', score: 3 },
      { text: 'Disorganized, you rely on memory or search functions', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-2',
    text: 'When encountering a new culture, you are:',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Very eager to learn and immerse yourself in it', value: 'high', score: 5 },
      { text: 'Interested in learning, but prefer some familiar comforts', value: 'medium', score: 3 },
      { text: 'Prefer to stick to what you know and are comfortable with', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-3',
    text: 'How comfortable are you speaking in front of a large group?',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Very comfortable and enjoy the spotlight', value: 'high', score: 5 },
      { text: 'Somewhat comfortable, but prefer smaller audiences', value: 'medium', score: 3 },
      { text: 'Uncomfortable and prefer to avoid it', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-4',
    text: 'When a friend tells you about their problems, you usually:',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Listen empathetically and offer emotional support', value: 'high', score: 5 },
      { text: 'Listen and offer practical advice', value: 'medium', score: 3 },
      { text: 'Find it difficult to engage and change the subject', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-5',
    text: 'How often do you feel down or depressed?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Often; it takes a lot to lift your spirits', value: 'high', score: 5 },
      { text: 'Sometimes, but you usually bounce back quickly', value: 'medium', score: 3 },
      { text: 'Rarely; you maintain a positive outlook', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-6',
    text: 'When working towards a goal, you are:',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Highly determined and disciplined', value: 'high', score: 5 },
      { text: 'Motivated, but can be sidetracked by new interests', value: 'medium', score: 3 },
      { text: 'Prone to procrastination and losing focus', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-7',
    text: 'You enjoy engaging in debates about complex topics:',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Very much; you love intellectual sparring', value: 'high', score: 5 },
      { text: 'Occasionally, if the topic interests you', value: 'medium', score: 3 },
      { text: 'Rarely; you prefer harmonious discussions', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-8',
    text: 'When attending a party, you typically prefer to:',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Be the life of the party and mingle with everyone', value: 'high', score: 5 },
      { text: 'Engage in meaningful conversations with a few chosen people', value: 'medium', score: 3 },
      { text: 'Find a quiet corner and observe, or leave early', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-9',
    text: 'When someone asks for a favor, you usually:',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'Say yes readily, even if it inconveniences you', value: 'high', score: 5 },
      { text: 'Consider it, and say yes if it fits your schedule', value: 'medium', score: 3 },
      { text: 'Decline if it interferes with your plans or needs', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-10',
    text: 'How often do you feel calm and relaxed?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Rarely; you often feel on edge or anxious', value: 'high', score: 5 },
      { text: 'Sometimes, depending on the situation', value: 'medium', score: 3 },
      { text: 'Most of the time; you rarely get stressed', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-11',
    text: 'You are attracted to hobbies that involve:',
    category: 'big5',
    dimension: 'openness',
    options: [
      { text: 'Creative expression and abstract thinking (e.g., writing, painting)', value: 'high', score: 5 },
      { text: 'Learning new skills and improving yourself', value: 'medium', score: 3 },
      { text: 'Practical tasks and concrete outcomes (e.g., gardening, cooking)', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-12',
    text: 'When managing your finances, you are:',
    category: 'big5',
    dimension: 'conscientiousness',
    options: [
      { text: 'Very diligent and plan meticulously', value: 'high', score: 5 },
      { text: 'Careful, but occasionally make impulse purchases', value: 'medium', score: 3 },
      { text: 'More relaxed and sometimes struggle with budgeting', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-13',
    text: 'You feel most energized when:',
    category: 'big5',
    dimension: 'extraversion',
    options: [
      { text: 'Attending a lively concert or social event', value: 'high', score: 5 },
      { text: 'Having a quiet dinner with a few close friends', value: 'medium', score: 3 },
      { text: 'Spending a peaceful evening alone with a book', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-14',
    text: 'You are more likely to forgive someone who has wronged you if:',
    category: 'big5',
    dimension: 'agreeableness',
    options: [
      { text: 'They show genuine remorse, even if it takes time', value: 'high', score: 5 },
      { text: 'They apologize and make an effort to amend', value: 'medium', score: 3 },
      { text: 'It depends on the severity of their actions; some things are unforgivable', value: 'low', score: 1 }
    ]
  },
  {
    id: 'b5-3-15',
    text: 'How easily do you get frustrated when things don\'t go your way?',
    category: 'big5',
    dimension: 'neuroticism',
    options: [
      { text: 'Very easily; it can be quite upsetting', value: 'high', score: 5 },
      { text: 'Somewhat, but you can usually adjust your expectations', value: 'medium', score: 3 },
      { text: 'Rarely; you are generally adaptable', value: 'low', score: 1 }
    ]
  },

  // MBTI Questions (15 questions)
  {
    id: 'mbti-3-1',
    text: 'When starting a new project, you are more likely to:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Organize your tasks and set clear milestones', value: 'J', score: 1 },
      { text: 'Begin without a strict plan and adjust as you go', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-3-2',
    text: 'You prefer to learn by:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'Focusing on details and practical applications', value: 'S', score: 1 },
      { text: 'Exploring concepts and abstract theories', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-3-3',
    text: 'When interacting with people, you tend to be:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Outwardly expressive and talkative', value: 'E', score: 1 },
      { text: 'Reserved and reflective', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-3-4',
    text: 'When making choices, you prioritize:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Objective analysis and fairness', value: 'T', score: 1 },
      { text: 'Empathy and impact on relationships', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-3-5',
    text: 'You are more inclined to notice:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'What is happening in the present moment', value: 'S', score: 1 },
      { text: 'The symbolic meanings and implications', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-3-6',
    text: 'Your approach to deadlines is generally:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'To meet them well in advance', value: 'J', score: 1 },
      { text: 'To work best under pressure closer to the deadline', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-3-7',
    text: 'When attending social events, you typically:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Seek out new people and enjoy group activities', value: 'E', score: 1 },
      { text: 'Prefer one-on-one conversations or small, familiar groups', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-3-8',
    text: 'When giving advice, you tend to focus on:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'What is rational and efficient', value: 'T', score: 1 },
      { text: 'What will be most supportive and encouraging', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-3-9',
    text: 'You enjoy conversations that are:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'Concrete and based on shared experiences', value: 'S', score: 1 },
      { text: 'Theoretical and explore new possibilities', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-3-10',
    text: 'You prefer your work environment to be:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Structured and predictable', value: 'J', score: 1 },
      { text: 'Flexible and open to improvisation', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-3-11',
    text: 'When working on a group project, you are more likely to:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Lead discussions and facilitate interaction', value: 'E', score: 1 },
      { text: 'Work quietly and contribute your ideas when asked', value: 'I', score: 1 }
    ]
  },
  {
    id: 'mbti-3-12',
    text: 'You tend to trust:',
    category: 'mbti',
    dimension: 'SN',
    options: [
      { text: 'Your five senses and direct observation', value: 'S', score: 1 },
      { text: 'Your gut feelings and insights', value: 'N', score: 1 }
    ]
  },
  {
    id: 'mbti-3-13',
    text: 'When conflicts arise, you focus on:',
    category: 'mbti',
    dimension: 'TF',
    options: [
      { text: 'Finding a logical solution to the problem', value: 'T', score: 1 },
      { text: 'Understanding everyone\'s feelings and restoring harmony', value: 'F', score: 1 }
    ]
  },
  {
    id: 'mbti-3-14',
    text: 'You prefer to keep your options:',
    category: 'mbti',
    dimension: 'JP',
    options: [
      { text: 'Decided and settled', value: 'J', score: 1 },
      { text: 'Open and flexible', value: 'P', score: 1 }
    ]
  },
  {
    id: 'mbti-3-15',
    text: 'When choosing a social activity, you lean towards:',
    category: 'mbti',
    dimension: 'EI',
    options: [
      { text: 'Large, lively events with lots of people', value: 'E', score: 1 },
      { text: 'Small, intimate gatherings or solo activities', value: 'I', score: 1 }
    ]
  },
];

// Combine all question variants for random selection
const allQuestionVariants: Question[][] = [
  questionsVariant1,
  questionsVariant2,
  questionsVariant3,
];

// MBTI Type Descriptions
const mbtiDescriptions: Record<string, string> = {
  'INTJ': 'The Architect - Imaginative and strategic thinkers with a plan for everything',
  'INTP': 'The Thinker - Innovative inventors with an unquenchable thirst for knowledge',
  'ENTJ': 'The Commander - Bold, imaginative and strong-willed leaders',
  'ENTP': 'The Debater - Smart and curious thinkers who cannot resist a challenge',
  'INFJ': 'The Advocate - Quiet and mystical, yet very inspiring and idealistic',
  'INFP': 'The Mediator - Poetic, kind and altruistic, always eager to help',
  'ENFJ': 'The Protagonist - Charismatic and inspiring leaders, able to mesmerize',
  'ENFP': 'The Campaigner - Enthusiastic, creative and sociable free spirits',
  'ISTJ': 'The Logistician - Practical and fact-oriented individuals',
  'ISFJ': 'The Defender - Very dedicated and warm protectors',
  'ESTJ': 'The Executive - Excellent administrators, unsurpassed at managing',
  'ESFJ': 'The Consul - Extraordinarily caring, social and popular',
  'ISTP': 'The Virtuoso - Bold and practical experimenters',
  'ISFP': 'The Adventurer - Flexible and charming artists',
  'ESTP': 'The Entrepreneur - Smart, energetic and perceptive',
  'ESFP': 'The Entertainer - Spontaneous, energetic and enthusiastic'
};

const PersonalityStep = () => {
  const navigate = useNavigate();
  const { updateIntake } = useIntake();

  // Select a random set of questions once when the component mounts
  const questions = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * allQuestionVariants.length);
    return allQuestionVariants[randomIndex];
  }, []);

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<PersonalityScores>({
    big5: {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0
    },
    mbti: {
      E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0
    }
  });
  console.log(scores);
  const [result, setResult] = useState<PersonalityResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Calculate results
  const calculateResults = useCallback(() => {
    // Calculate Big 5 percentages
    const big5Counts = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0
    };

    // Calculate maximum possible score for each Big 5 dimension based on the selected question set
    const big5QuestionsCount: Record<string, number> = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0
    };

    questions.filter(q => q.category === 'big5').forEach(q => {
      big5QuestionsCount[q.dimension as keyof typeof big5QuestionsCount]++;
      const answer = answers[q.id];
      if (answer) {
        big5Counts[q.dimension as keyof typeof big5Counts] += answer.score;
      }
    });

    const big5Profile = {
      openness: big5QuestionsCount.openness > 0 ? (big5Counts.openness / (big5QuestionsCount.openness * 5)) * 100 : 0,
      conscientiousness: big5QuestionsCount.conscientiousness > 0 ? (big5Counts.conscientiousness / (big5QuestionsCount.conscientiousness * 5)) * 100 : 0,
      extraversion: big5QuestionsCount.extraversion > 0 ? (big5Counts.extraversion / (big5QuestionsCount.extraversion * 5)) * 100 : 0,
      agreeableness: big5QuestionsCount.agreeableness > 0 ? (big5Counts.agreeableness / (big5QuestionsCount.agreeableness * 5)) * 100 : 0,
      neuroticism: big5QuestionsCount.neuroticism > 0 ? (big5Counts.neuroticism / (big5QuestionsCount.neuroticism * 5)) * 100 : 0
    };

    // Calculate MBTI type
    const mbtiScores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    questions.filter(q => q.category === 'mbti').forEach(q => {
      const answer = answers[q.id];
      if (answer && answer.value) {
        mbtiScores[answer.value as keyof typeof mbtiScores] += 1;
      }
    });

    const mbtiType =
      (mbtiScores.E >= mbtiScores.I ? 'E' : 'I') +
      (mbtiScores.S >= mbtiScores.N ? 'S' : 'N') +
      (mbtiScores.T >= mbtiScores.F ? 'T' : 'F') +
      (mbtiScores.J >= mbtiScores.P ? 'J' : 'P');

    // Determine dominant traits (threshold can be adjusted)
    const dominantTraits = [];
    if (big5Profile.openness > 70) dominantTraits.push('Creative & Open-minded');
    if (big5Profile.conscientiousness > 70) dominantTraits.push('Organized & Reliable');
    if (big5Profile.extraversion > 70) dominantTraits.push('Outgoing & Energetic');
    if (big5Profile.agreeableness > 70) dominantTraits.push('Compassionate & Cooperative');
    // For Neuroticism, a low score indicates emotional stability, which is a strength
    if (big5Profile.neuroticism < 30) dominantTraits.push('Emotionally Stable');
    if (big5Profile.neuroticism > 70) dominantTraits.push('Sensitive & Reflective'); // High neuroticism can also be a trait, depending on interpretation

    const result: PersonalityResult = {
      big5Profile,
      mbtiType,
      dominantTraits,
      description: mbtiDescriptions[mbtiType] || 'A unique and complex individual, further exploration recommended.'
    };

    setResult(result);
    updateIntake({
      personalityResult: result,
      personalityAnswers: answers
    });
  }, [answers, questions, updateIntake]); // Added 'questions' to useCallback dependencies

  // Handle answer selection
  const handleAnswer = (option: any) => {
    setSelectedOption(option.value);

    // Animate selection
    setTimeout(() => {
      const newAnswers = { ...answers, [currentQuestion.id]: option };
      setAnswers(newAnswers);

      // No need to update 'scores' state here if calculation is done at the end
      // setScores(prev => { /* ... */ });

      // Move to next question or show results
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
      } else {
        setShowResult(true);
      }
    }, 600);
  };

  // Calculate results when quiz completes
  useEffect(() => {
    if (showResult && !result) {
      calculateResults();
    }
  }, [showResult, result, calculateResults]);

  const handleNext = () => {
    navigate('/intake/register');
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setScores({ // Reset scores for a clean slate
      big5: { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 },
      mbti: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
    });
    setResult(null);
    setShowResult(false);
    setSelectedOption(null);
    // Note: The 'questions' array will remain the same for the current session
    // if you want a new random set on restart, you'd need to re-memoize or similar.
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Three.js Background */}
      <BasicScene />

      {/* Gradient overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-pink-100/50 pointer-events-none"
      />

      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl"
        >
          <GlassCard enhanced gradient className="text-center space-y-6 max-h-[85vh] overflow-y-auto overflow-x-hidden mx-4">
            {/* Header */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-white text-shadow-soft">Personality Discovery</h2>
              <p className="text-white/80">
                {showResult ? 'Your personality profile is ready!' : 'Answer honestly to discover your unique personality traits'}
              </p>
            </motion.div>

            {!showResult ? (
              <>
                {/* Progress */}
                <div className="glass-card-enhanced p-4 rounded-xl">
                  <div className="flex justify-between text-sm text-white/70 mb-2">
                    <span>Progress</span>
                    <span>{currentQuestionIndex + 1} of {questions.length}</span>
                  </div>
                  <GlassProgress value={progress} max={100} />
                </div>

                {/* Question */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="glass-card-enhanced p-6 rounded-xl">
                      <div className="mb-2">
                        <span className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full">
                          {currentQuestion.category === 'big5' ? 'Big Five' : 'MBTI'} Assessment
                        </span>
                      </div>
                      <h3 className="text-xl text-white font-medium">
                        {currentQuestion.text}
                      </h3>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      {currentQuestion.options.map((option, index) => (
                        <motion.button
                          key={option.value}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => handleAnswer(option)}
                          disabled={selectedOption !== null}
                          className={`
                            w-full text-left p-4 rounded-xl transition-all duration-300
                            ${selectedOption === option.value
                              ? 'glass-card-enhanced bg-gradient-to-r from-indigo-400/30 to-purple-400/30 scale-105'
                              : 'glass-card hover:scale-102 hover:bg-white/15'
                            }
                            ${selectedOption && selectedOption !== option.value ? 'opacity-50' : ''}
                          `}
                        >
                          <p className="text-white font-medium">{option.text}</p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              /* Results */
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    {/* MBTI Type */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="glass-card-enhanced p-6 rounded-xl"
                    >
                      <h3 className="text-sm text-white/70 mb-2">Your Personality Type</h3>
                      <div className="text-4xl font-bold text-white mb-3 tracking-wider">
                        {result.mbtiType}
                      </div>
                      <p className="text-white/80 text-lg">{result.description}</p>
                    </motion.div>

                    {/* Big 5 Profile */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="glass-card-enhanced p-6 rounded-xl space-y-4"
                    >
                      <h3 className="text-white font-semibold mb-4">Big Five Profile</h3>

                      {Object.entries(result.big5Profile).map(([trait, score], index) => (
                        <motion.div
                          key={trait}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                          className="space-y-2"
                        >
                          <div className="flex justify-between text-sm">
                            <span className="text-white/80 capitalize">{trait}</span>
                            <span className="text-white font-medium">{Math.round(score)}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                              className={`h-full rounded-full bg-gradient-to-r ${
                                trait === 'openness' ? 'from-blue-400 to-indigo-400' :
                                trait === 'conscientiousness' ? 'from-green-400 to-emerald-400' :
                                trait === 'extraversion' ? 'from-yellow-400 to-orange-400' :
                                trait === 'agreeableness' ? 'from-pink-400 to-rose-400' :
                                'from-purple-400 to-violet-400'
                              }`}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Dominant Traits */}
                    {result.dominantTraits.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                        className="glass-card-enhanced p-6 rounded-xl"
                      >
                        <h3 className="text-white font-semibold mb-3">Your Strengths</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.dominantTraits.map((trait, index) => (
                            <motion.span
                              key={trait}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 1.4 + index * 0.1 }}
                              className="bg-white/20 text-white px-4 py-2 rounded-full text-sm"
                            >
                              {trait}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Actions */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.6 }}
                      className="flex gap-3 justify-center pt-4"
                    >
                      <GlassButton
                        onClick={restartQuiz}
                        className="bg-white/10 hover:bg-white/20"
                      >
                        Retake Quiz
                      </GlassButton>

                      <GlassButton
                        onClick={handleNext}
                        className="bg-gradient-to-r from-indigo-400/20 to-purple-400/20 hover:from-indigo-400/30 hover:to-purple-400/30"
                      >
                        <span className="flex items-center space-x-2">
                          <span>Complete Profile</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </GlassButton>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default PersonalityStep;
