import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bug, CheckCircle2, Lightbulb, MessageSquarePlus, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { api } from '../lib/adminApi';
import { HONEYPOT_FIELD, HONEYPOT_PROPS } from '../lib/antiSpam';
import { PLAN_LIMITS } from '../lib/planVocabulary';

/**
 * The intake door for the studio's feedback & planning board.
 *
 * TWO DOORS, ONE MODAL (§3.3 of `plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md`).
 * The public door and the staff door are deliberately different endpoints with different
 * contracts, because the anonymous one is a wider attack surface and must accept strictly less:
 *
 *   mode        endpoint                 guard         the server forces
 *   feedback    POST /api/plan/feedback  none (public) kind='suggestion', source='public'
 *   feature     POST /api/plan/items     requireAuth   source='studio', author from the session
 *   bug         POST /api/plan/items     requireAuth   source='studio', author from the session
 *
 * ⚠️ `source` and `author_id` ARE NEVER SENT FROM HERE, and sending them would change nothing:
 * the server derives both. That is what stops an anonymous caller filing as staff.
 *
 * A `viewer` may use all three. Filing is not triaging — §3.4 is explicit that anyone may knock
 * and only editors open the door.
 *
 * ⚠️ THE HONEYPOT IS RENDERED BUT NOT ENFORCED HERE.
 * `company_website` is off-screen and empty for a human; a bot that fills every input trips it and
 * the server drops the submission. On the two authenticated modes the server deliberately ignores
 * it — a heuristic must never silently discard a staff member's work — but the field is rendered
 * anyway so the three modes share one form and one code path.
 */

export type FeedbackMode = 'feedback' | 'feature' | 'bug';

interface FeedbackModalProps {
  open: boolean;
  mode: FeedbackMode;
  onClose: () => void;
}

const COPY: Record<
  FeedbackMode,
  { title: string; description: string; submit: string; placeholder: string; icon: React.ComponentType<{ className?: string }> }
> = {
  feedback: {
    title: 'Feedback & suggestions',
    description:
      'Tell the studio what would make this site better. No account needed, and every message is read.',
    submit: 'Send feedback',
    placeholder: 'What would you change?',
    icon: MessageSquarePlus,
  },
  feature: {
    title: 'Request a feature',
    description: 'Describe what you would like the studio’s tools to do. It lands on the board for triage.',
    submit: 'Request feature',
    placeholder: 'What should it do?',
    icon: Lightbulb,
  },
  bug: {
    title: 'Report a bug',
    description: 'Something broken or behaving oddly. The more specific, the faster it can be fixed.',
    submit: 'Report bug',
    placeholder: 'What went wrong?',
    icon: Bug,
  },
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ open, mode, onClose }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const copy = COPY[mode];
  const Icon = copy.icon;
  const isPublic = mode === 'feedback';

  // Reset on open, and again on close, so a second submission never shows the first one's text
  // or its success panel.
  useEffect(() => {
    setTitle('');
    setBody('');
    setEmail('');
    setHoneypot('');
    setError(null);
    setSent(false);
  }, [open, mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('A short summary is required.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      if (isPublic) {
        await api('/api/plan/feedback', {
          method: 'POST',
          body: {
            title: title.trim(),
            body: body.trim() || null,
            email: email.trim() || null,
            // Telemetry: which page the visitor was on. The server drops it if it is not a URL.
            page_url: window.location.href,
            [HONEYPOT_FIELD]: honeypot,
          },
        });
      } else {
        await api('/api/plan/items', {
          method: 'POST',
          body: {
            kind: mode,
            title: title.trim(),
            body: body.trim() || null,
            [HONEYPOT_FIELD]: honeypot,
          },
        });
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send that. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium">Thank you — that is on the board.</p>
            <p className="text-xs text-muted-foreground">
              {isPublic
                ? 'The studio reads every message. If you left an address, they can reply.'
                : 'An editor will triage it from the Planning board.'}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-title">Summary</Label>
              <Input
                id="feedback-title"
                value={title}
                maxLength={PLAN_LIMITS.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.placeholder}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-body">Details</Label>
              <Textarea
                id="feedback-body"
                value={body}
                maxLength={PLAN_LIMITS.body}
                rows={5}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Anything that would help — what you expected, what happened instead."
              />
            </div>

            {isPublic && (
              <div className="space-y-2">
                <Label htmlFor="feedback-email">Email (optional)</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Only if you would like a reply"
                />
              </div>
            )}

            {/*
              The honeypot. Off-screen rather than `display: none`, because some bots skip inputs
              that are not rendered at all; `HONEYPOT_PROPS` supplies the name the server reads, so
              the two can never drift apart. `aria-hidden` and `tabIndex={-1}` keep it away from
              screen readers and the tab order.
            */}
            <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="feedback-company">Company website</label>
              <Input
                id="feedback-company"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                {...HONEYPOT_PROPS}
              />
            </div>

            {error && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending}>
                <Send className="h-4 w-4" />
                {sending ? 'Sending…' : copy.submit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
