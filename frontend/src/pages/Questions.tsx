import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Code2, ArrowLeft, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QUESTION_ENDPOINTS } from '@/lib/api';

interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string[];
}

const difficultyColors = {
  easy: 'text-success border-success/30 bg-success/10',
  medium: 'text-warning border-warning/30 bg-warning/10',
  hard: 'text-destructive border-destructive/30 bg-destructive/10',
};

const emptyForm = { title: '', description: '', difficulty: 'easy', topic: '' };

const Questions = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'developer') {
      navigate('/match');
      return;
    }
    fetchQuestions();
  }, [user]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(QUESTION_ENDPOINTS.getAllQuestions);
      const data = await response.json();
      setQuestions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingQuestion(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (question: Question) => {
    setEditingQuestion(question);
    setForm({
      title: question.title,
      description: question.description,
      difficulty: question.difficulty,
      topic: question.topic.join(', '),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingQuestion(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (editingQuestion) {
      editQuestion(editingQuestion.id);
    } else {
      addQuestion();
    }
  };

  const addQuestion = async () => {
    try {
        setFormLoading(true);
        setError(null);
        const response = await fetch(QUESTION_ENDPOINTS.addQuestion, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            difficulty: form.difficulty,
            topic: form.topic.split(',').map((t) => t.trim()),
          }),
        });
        closeModal();
        fetchQuestions();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setFormLoading(false);
      }
  };

  const editQuestion = async (questionId: string) => {
    try {
        setFormLoading(true);
        setError(null);
        const response = await fetch(QUESTION_ENDPOINTS.updateQuestion(questionId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            difficulty: form.difficulty,
            topic: form.topic.split(',').map((t) => t.trim()),
          }),
        });
        closeModal();
        fetchQuestions();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setFormLoading(false);
      }
  };

  const handleDelete = async (questionId: string) => {
    try {
      setDeleteLoading(questionId);
      setError(null);
      const response = await fetch(QUESTION_ENDPOINTS.deleteQuestion(questionId), {
        method: 'DELETE',
      });
      fetchQuestions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-glow opacity-20" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gradient">PeerPrep</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/match')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 py-12 max-w-4xl">
        {/* Title + Add Button */}
        <div className="flex items-center justify-between mb-12 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Question <span className="text-gradient">Bank</span>
            </h1>
            <p className="text-muted-foreground">Manage the question database</p>
          </div>
          <Button variant="hero" size="sm" onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        {/* Questions List */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <p className="text-foreground font-medium">No questions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first question to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-xl border border-border bg-card p-6 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-medium text-foreground truncate">{question.title}</p>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border capitalize shrink-0',
                          difficultyColors[question.difficulty],
                        )}
                      >
                        {question.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{question.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {question.topic.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(question)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(question.id)}
                      disabled={deleteLoading === question.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deleteLoading === question.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-lg mx-6 rounded-2xl border border-border bg-card p-8 shadow-glow animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingQuestion ? 'Edit Question' : 'Add Question'}
              </h2>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  placeholder="Two Sum"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  placeholder="Given an array of integers..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Topic</label>
                  <input
                    type="text"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="arrays"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 mt-8">
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={handleSubmit}
                disabled={formLoading || !form.title || !form.description || !form.topic}
              >
                {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingQuestion ? 'Save Changes' : 'Add Question'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Questions;
