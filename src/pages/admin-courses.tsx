import { useEffect, useState } from 'react';
import { BookOpen, Check, X, Trash2, Eye, RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getImageUrl } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';

interface AdminCourseItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  status: 'pending' | 'approved' | 'disapproved';
  admin_feedback?: string;
  instructor: string;
  updated_at: string;
}

const API_BASE = 'http://localhost:8081';

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`${API_BASE}/api/admin/courses`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load moderation queue');
      setCourses(data.courses ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCourses();
  }, []);

  const actOnCourse = async (courseId: string, status: 'approved' | 'disapproved') => {
    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`${API_BASE}/api/admin/courses/${courseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status, admin_feedback: feedback[courseId] || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Course action failed');
      toast.success(data.message || 'Course updated');
      await fetchCourses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Course action failed');
    }
  };

  const removeCourse = async (courseId: string) => {
    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`${API_BASE}/api/admin/courses/${courseId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      toast.success(data.message || 'Course deleted');
      await fetchCourses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Course Moderation"
        description="Review instructor submissions and approve or reject them before students can see them."
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchCourses()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading moderation queue…</CardContent></Card>
      ) : courses.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No pending courses in review.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden">
              <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-center">
                <div className="h-32 overflow-hidden bg-muted md:h-full">
                  {course.thumbnail_url ? (
                    <img src={getImageUrl(course.thumbnail_url)} alt={course.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground"><BookOpen className="h-8 w-8" /></div>
                  )}
                </div>
                <div className="space-y-3 p-4 md:p-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{course.title}</h3>
                    <Badge variant="secondary">{course.category}</Badge>
                    <Badge variant="outline">{course.difficulty}</Badge>
                    <Badge className={course.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}>{course.status}</Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{course.description || 'No description provided.'}</p>
                  <div className="text-xs text-muted-foreground">
                    Instructor: {course.instructor || 'Unknown'} • Updated {new Date(course.updated_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-4 md:p-0 md:pr-4">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/courses/${course.id}`, '_blank')}>
                    <Eye className="mr-2 h-4 w-4" /> Preview
                  </Button>
                  <Textarea
                    value={feedback[course.id] ?? course.admin_feedback ?? ''}
                    onChange={(event) => setFeedback((current) => ({ ...current, [course.id]: event.target.value }))}
                    placeholder="Optional feedback for the instructor"
                    className="min-h-16 text-xs"
                  />
                  <Button size="sm" onClick={() => void actOnCourse(course.id, 'approved')}>
                    <Check className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void actOnCourse(course.id, 'disapproved')}>
                    <X className="mr-2 h-4 w-4" /> Reject
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void removeCourse(course.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
