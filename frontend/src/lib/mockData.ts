export const difficulties = [
  { id: 'easy', label: 'Easy', color: 'text-success', description: 'Warm-up problems' },
  { id: 'medium', label: 'Medium', color: 'text-warning', description: 'Standard interview level' },
  { id: 'hard', label: 'Hard', color: 'text-destructive', description: 'Advanced challenges' },
] as const;

export const languages = [
  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'cpp', label: 'C++', icon: '⚙️' },
  { id: 'typescript', label: 'TypeScript', icon: '🔷' },
  { id: 'go', label: 'Go', icon: '🐹' },
] as const;

export const topics = [
  { id: 'arrays', label: 'Arrays & Strings', icon: '📊' },
  { id: 'linked-lists', label: 'Linked Lists', icon: '🔗' },
  { id: 'trees', label: 'Trees & Graphs', icon: '🌳' },
  { id: 'dynamic-programming', label: 'Dynamic Programming', icon: '📈' },
  { id: 'sorting', label: 'Sorting & Searching', icon: '🔍' },
  { id: 'recursion', label: 'Recursion', icon: '🔄' },
  { id: 'stacks-queues', label: 'Stacks & Queues', icon: '📚' },
  { id: 'hash-tables', label: 'Hash Tables', icon: '#️⃣' },
] as const;

export const mockQuestions: Record<
  string,
  { title: string; description: string; examples: string[]; constraints: string[] }
> = {
  'easy-arrays': {
    title: 'Two Sum',
    description:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    examples: [
      'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].',
      'Input: nums = [3,2,4], target = 6\nOutput: [1,2]',
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
  },
  'medium-trees': {
    title: 'Binary Tree Level Order Traversal',
    description:
      "Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).",
    examples: [
      'Input: root = [3,9,20,null,null,15,7]\nOutput: [[3],[9,20],[15,7]]',
      'Input: root = [1]\nOutput: [[1]]',
    ],
    constraints: [
      'The number of nodes in the tree is in the range [0, 2000].',
      '-1000 <= Node.val <= 1000',
    ],
  },
  'hard-dynamic-programming': {
    title: 'Edit Distance',
    description:
      'Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2. You have the following three operations permitted on a word: Insert a character, Delete a character, Replace a character.',
    examples: [
      'Input: word1 = "horse", word2 = "ros"\nOutput: 3\nExplanation: horse -> rorse -> rose -> ros',
      'Input: word1 = "intention", word2 = "execution"\nOutput: 5',
    ],
    constraints: [
      '0 <= word1.length, word2.length <= 500',
      'word1 and word2 consist of lowercase English letters.',
    ],
  },
};

export const getQuestion = (difficulty: string, topic: string) => {
  const key = `${difficulty}-${topic}`;
  return mockQuestions[key] || mockQuestions['easy-arrays'];
};

export const starterCode = `function solution(input) {
  // Write your solution here
  
  return result;
}`;
