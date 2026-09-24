import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  Sparkles,
  Settings,
  LogOut,
  User,
  CreditCard,
  ChevronDown,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { CommandMenu } from '@/components/common/command-menu';
import { useAuth, roleDashboardPath } from '@/components/providers/auth-provider';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const roleIcon = {
  student: GraduationCap,
  instructor: Users,
  admin: ShieldCheck,
};

const roleAccent = {
  student: 'text-primary',
  instructor: 'text-teal',
  admin: 'text-warning',
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);

  const displayName = user?.name ?? 'Learner';
  const email = user?.email ?? '';
  const avatarUrl = user?.avatarUrl ?? '';
  const role = user?.role ?? 'student';
  const RoleIcon = roleIcon[role];

  const handleSignOut = () => {
    signOut();
    toast.success('Signed out', { description: 'See you soon!' });
    navigate('/login');
  };

  const settingsPath = `${roleDashboardPath[role].replace('/dashboard', '')}/settings`;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <button
          onClick={() => setCommandOpen(true)}
          className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:border-input/80"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search or ask Akademia…</span>
          <kbd className="hidden shrink-0 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* Role badge (read-only, no switching) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium">
            <RoleIcon className={cn('h-4 w-4', roleAccent[role])} />
            <span className="hidden capitalize sm:inline">{role}</span>
          </div>

          {role === 'student' && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 text-muted-foreground hover:text-foreground md:flex"
              onClick={() => navigate('/student/ai-coach')}
            >
              <Sparkles className="h-4 w-4 text-teal" />
              <span>AI Coach</span>
            </Button>
          )}

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-[1.15rem] w-[1.15rem]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-accent">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-3 py-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <div className="px-2 pb-1">
                <Badge className="w-full justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/10">
                  <Sparkles className="h-3 w-3" />
                  PRO PLAN
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
