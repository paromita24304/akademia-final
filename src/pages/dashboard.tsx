import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Trophy,
  Clock,
  Flame,
  Zap,
  ArrowRight,
  Sparkles,
  BookOpen,
  CheckCircle2,
  PlayCircle,
  Award,
  TrendingUp,
  Target,
  MessageSquare,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import {
  stats,
  courses,
  achievements,
  recentActivity,
  aiConversations,
  weeklyActivity,
} from '@/lib/mock-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useLessonProgress } from '@/hooks/use-lesson-progress';
import { getAllLessons } from '@/lib/course-utils';
import { formatNumber, relativeTime, getIcon, initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getStudentCourses } from '@/lib/course-utils';
import { loadLearningSummary, type LearningSummary, useStudentPortalState } from '@/lib/student-api';

const activityIcon = {
  'lesson-completed': { icon: CheckCircle2, class: 'bg-success/10 text-success' },
  'course-started': { icon: PlayCircle, class: 'bg-info/10 text-info' },
  'course-completed': { icon: Trophy, class: 'bg-success/10 text-success' },
  achievement: { icon: Trophy, class: 'bg-warning/10 text-warning' },
  'quiz-passed': { icon: Target, class: 'bg-primary/10 text-primary' },
  'ai-coaching': { icon: Sparkles, class: 'bg-teal/10 text-teal' },
  streak: { icon: Zap, class: 'bg-destructive/10 text-destructive' },
} as const;

const rarityStyles: Record<string, string> = {
  common: 'border-border bg-muted',
  rare: 'border-info/30 bg-info/5',
  epic: 'border-primary/30 bg-primary/5',
  legendary: 'border-warning/40 bg-warning/5',
};

export function DashboardPage() {
  const { user } = useAuth();
  const { state } = useStudentPortalState();
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  useEffect(() => { loadLearningSummary().then(setSummary).catch(() => undefined); }, [state]);
  // Provider-hosted courses do not expose learner progress to Akademia. Never
  // populate this dashboard with fake progress for them.
  const inProgress: typeof courses = [];
  const completed: typeof courses = [];
  const studentCourses = [...inProgress, ...completed];
  const continueCourse = inProgress[0];
  // Until instructors publish real courses, no historical mock course activity
  // is displayed. These values will later be supplied by the same course API.
  const liveStats = { ...stats, coursesCompleted: completed.length, hoursLearned: 0, currentStreak: 0, skillPoints: 0, weeklyAchievedMinutes: 0 };
  const weeklyPct = Math.round((liveStats.weeklyAchievedMinutes / liveStats.weeklyGoalMinutes) * 100);
  const unlockedAchievements: typeof achievements = [];

  return (
    <div className="space-y-6 animate-in-slide">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Learner'}`}
        description="Here's a summary of your learning journey."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/student/browse">
                <BookOpen className="mr-2 h-4 w-4" />
                Browse
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/student/ai-coach">
                <Sparkles className="mr-2 h-4 w-4" />
                Ask Akademia
              </Link>
            </Button>
          </>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Courses completed"
          value={liveStats.coursesCompleted}
          icon={Trophy}
          accent="primary"
          trend={{ value: '+2 this month', positive: true }}
        />
        <StatCard
          label="Hours learned"
          value={liveStats.hoursLearned}
          icon={Clock}
          accent="info"
          trend={{ value: '+8h this week', positive: true }}
        />
        <StatCard
          label="Current streak"
          value={`${liveStats.currentStreak} days`}
          icon={Flame}
          accent="warning"
          trend={{ value: 'Personal best', positive: true }}
        />
        <StatCard
          label="Skill points"
          value={formatNumber(liveStats.skillPoints)}
          icon={Zap}
          accent="success"
          trend={{ value: '+420 this week', positive: true }}
        />
      </div>

      {/* Continue learning + weekly goal */}
      <div className="grid gap-4 lg:grid-cols-3">
        {continueCourse && <ContinueLearningCard course={continueCourse} />}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly goal</CardTitle>
            <CardDescription>Keep your streak alive</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-0">
            <ProgressRing value={weeklyPct} />
            <div className="mt-4 grid w-full grid-cols-7 gap-1">
              {weeklyActivity.map((d, i) => (
                <div key={d.day} className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'h-12 w-full rounded-md transition-colors',
                      d.minutes > 60
                        ? 'bg-primary'
                        : d.minutes > 30
                        ? 'bg-primary/60'
                        : d.minutes > 0
                        ? 'bg-primary/30'
                        : 'bg-muted'
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.day[0]}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {liveStats.weeklyAchievedMinutes} / {liveStats.weeklyGoalMinutes} min this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Course overview: ongoing + completed side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PlayCircle className="h-4 w-4 text-primary" />
                In progress
              </CardTitle>
              <CardDescription>{inProgress.length} courses</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/student/my-courses">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {inProgress.slice(0, 3).map((c) => (
              <MiniCourseRow key={c.id} course={c} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Completed
              </CardTitle>
              <CardDescription>{completed.length} courses</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/student/my-courses">
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {completed.slice(0, 3).map((c) => (
              <MiniCourseRow key={c.id} course={c} completed />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI coach + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-teal" />
                AI Coach
              </CardTitle>
              <CardDescription>Recent conversations</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/student/ai-coach">New</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {([] as typeof aiConversations).map((conv) => (
              <Link
                key={conv.id}
                to="/student/ai-coach"
                className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent"
              >
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {conv.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{conv.preview}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {relativeTime(conv.lastMessageAt)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Your learning timeline</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-1">
              {([] as typeof recentActivity).map((act, i) => {
                const cfg = activityIcon[act.type];
                const Icon = cfg.icon;
                return (
                  <li key={act.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < 0 && (
                      <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
                    )}
                    <div className={cn('z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full', cfg.class)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium text-foreground">{act.title}</p>
                      <p className="text-xs text-muted-foreground">{act.detail}</p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                      {relativeTime(act.timestamp)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Skills + Achievements summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Skill progress
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/student/skills">Details</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentCourses
              .filter((c) => c.status !== 'not-started')
              .slice(0, 4)
              .map((c) => (
                <CourseSkillBar key={c.id} course={c} />
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-warning" />
              Recent achievements
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/student/achievements">All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {unlockedAchievements.slice(0, 4).map((ach) => {
                const Icon = getIcon(ach.icon);
                return (
                  <div
                    key={ach.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 transition-transform hover:scale-[1.02]',
                      rarityStyles[ach.rarity]
                    )}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-background">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{ach.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{ach.description}</p>
                    </div>
                    <Award className="h-3.5 w-3.5 shrink-0 text-warning" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContinueLearningCard({ course }: { course: typeof courses[number] }) {
  const { completedLessons } = useLessonProgress(course.id);
  const allLessons = getAllLessons(course);
  const completed = allLessons.filter((l) => completedLessons.has(l.id)).length;
  const total = allLessons.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : course.progress;
  const lastCompletedIdx = allLessons.reduce((last, l, i) => (completedLessons.has(l.id) ? i : last), -1);
  const resumeLesson = allLessons[Math.min(lastCompletedIdx + 1, total - 1)] ?? allLessons[0];

  return (
    <Card className="relative col-span-1 overflow-hidden lg:col-span-2">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-teal/5" />
      <CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-56">
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-background/90 shadow-lg transition-transform hover:scale-110">
              <PlayCircle className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Badge className="mb-2 gap-1 bg-primary/10 text-primary hover:bg-primary/10">
            <Sparkles className="h-3 w-3" />
            Continue learning
          </Badge>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {course.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {course.subtitle}
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {completed} of {total} lessons completed
              </span>
              <span className="font-medium text-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
          <Button className="mt-4" size="sm" asChild>
            <Link to={`/student/courses/${course.slug}/learn?lesson=${resumeLesson?.id ?? ''}`}>
              Resume lesson
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniCourseRow({ course, completed }: { course: typeof courses[number]; completed?: boolean }) {
  const { completedLessons } = useLessonProgress(course.id);
  const allLessons = getAllLessons(course);
  const done = allLessons.filter((l) => completedLessons.has(l.id)).length;
  const total = allLessons.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : course.progress;

  return (
    <Link
      to={completed ? `/student/courses/${course.slug}` : `/student/courses/${course.slug}/learn`}
      className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
    >
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md">
        <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
        {completed && (
          <div className="absolute inset-0 grid place-items-center bg-success/20">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{course.title}</p>
        <p className="text-xs text-muted-foreground">{completed ? 'Completed' : `${pct}% complete`}</p>
      </div>
      {!completed && <Progress value={pct} className="h-1.5 w-16" />}
    </Link>
  );
}

function CourseSkillBar({ course }: { course: typeof courses[number] }) {
  const { completedLessons } = useLessonProgress(course.id);
  const allLessons = getAllLessons(course);
  const done = allLessons.filter((l) => completedLessons.has(l.id)).length;
  const total = allLessons.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : course.progress;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="truncate font-medium text-foreground">{course.title}</span>
        <span className="ml-2 shrink-0 text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="6"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-lg font-semibold tabular-nums text-foreground">
        {value}%
      </span>
    </div>
  );
}

