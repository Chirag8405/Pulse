"use client";

import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useEventsFeed } from "@/hooks/useAdminRealtime";
import {
  createAdminEvent,
  updateAdminEventStatus,
} from "@/lib/firebase/adminApi";
import { logVenueAnalyticsEvent } from "@/lib/firebase/analytics";
import { getErrorMessage } from "@/lib/shared/errorUtils";
import type { Event } from "@/types/firebase";

interface EventFormValues {
  homeTeam: string;
  awayTeam: string;
  startTimeInput: string;
  matchDay: string;
}

const INITIAL_EVENT_FORM: EventFormValues = {
  homeTeam: "",
  awayTeam: "",
  startTimeInput: "",
  matchDay: "",
};

function getStatusBadgeClass(status: Event["status"]): string {
  if (status === "live") {
    return "rounded-none border-2 border-border bg-red-600 px-2 py-1 text-xs font-bold text-white";
  }

  if (status === "halftime") {
    return "rounded-none border-2 border-border bg-amber-400 px-2 py-1 text-xs font-bold text-black";
  }

  if (status === "completed") {
    return "rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground";
  }

  return "rounded-none border-2 border-border bg-zinc-200 px-2 py-1 text-xs font-bold text-black dark:bg-zinc-800 dark:text-foreground";
}

function AdminEventsContent() {
  const { user } = useAuth();
  const { data: events, loading, error } = useEventsFeed(100);

  const [formValues, setFormValues] = useState<EventFormValues>(INITIAL_EVENT_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [eventToEnd, setEventToEnd] = useState<Event | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (left, right) => right.startTime.toMillis() - left.startTime.toMillis()
    );
  }, [events]);

  const hasAnotherLiveEvent = (eventId: string) =>
    events.some(
      (eventItem) =>
        eventItem.id !== eventId &&
        (eventItem.status === "live" || eventItem.status === "halftime")
    );

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !formValues.homeTeam.trim() ||
      !formValues.awayTeam.trim() ||
      !formValues.startTimeInput ||
      !formValues.matchDay.trim()
    ) {
      toast.error("Please complete all event fields.");
      return;
    }

    const parsedStart = new Date(formValues.startTimeInput);

    if (Number.isNaN(parsedStart.getTime())) {
      toast.error("Start time is invalid.");
      return;
    }

    setIsCreating(true);

    try {
      if (!user) {
        toast.error("Authentication expired. Please sign in again.");
        return;
      }

      await createAdminEvent(user, {
        homeTeam: formValues.homeTeam.trim(),
        awayTeam: formValues.awayTeam.trim(),
        startTimeIso: parsedStart.toISOString(),
        matchDay: formValues.matchDay.trim(),
      });

      toast.success("Event created successfully.");
      setFormValues(INITIAL_EVENT_FORM);
    } catch (createError) {
      toast.error(getErrorMessage(createError, "Could not create event."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (
    eventItem: Event,
    nextStatus: Event["status"],
    options?: {
      analyticsEvent?: "event_started" | "event_halftime" | "event_ended";
      successToast?: string;
      suggestionToast?: string;
    }
  ) => {
    if (nextStatus === "live" && hasAnotherLiveEvent(eventItem.id)) {
      toast.error("Another event is already live. End it before starting a new one.");
      return;
    }

    setUpdatingEventId(eventItem.id);

    try {
      if (!user) {
        toast.error("Authentication expired. Please sign in again.");
        return;
      }

      await updateAdminEventStatus(user, {
        eventId: eventItem.id,
        status: nextStatus,
      });

      if (options?.analyticsEvent) {
        logVenueAnalyticsEvent(options.analyticsEvent, {
          eventId: eventItem.id,
          status: nextStatus,
        });
      }

      if (options?.successToast) {
        toast.success(options.successToast);
      }

      if (options?.suggestionToast) {
        toast(options.suggestionToast);
      }
    } catch (updateError) {
      toast.error(getErrorMessage(updateError, "Could not update event status."));
    } finally {
      setUpdatingEventId(null);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Event Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create events and control live match state transitions.
        </p>
      </header>

      <section className="nb-card bg-card p-5">
        <h2 className="text-xl font-black tracking-tight">Create Event</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateEvent}>
          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="event-home-team">
              Home Team
            </label>
            <Input
              id="event-home-team"
              value={formValues.homeTeam}
              onChange={(changeEvent) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  homeTeam: changeEvent.target.value,
                }))
              }
              className="rounded-none border-2 border-border"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="event-away-team">
              Away Team
            </label>
            <Input
              id="event-away-team"
              value={formValues.awayTeam}
              onChange={(changeEvent) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  awayTeam: changeEvent.target.value,
                }))
              }
              className="rounded-none border-2 border-border"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="event-start-time">
              Start Time
            </label>
            <Input
              id="event-start-time"
              type="datetime-local"
              value={formValues.startTimeInput}
              onChange={(changeEvent) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  startTimeInput: changeEvent.target.value,
                }))
              }
              className="rounded-none border-2 border-border"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="event-match-day">
              Match Day Label
            </label>
            <Input
              id="event-match-day"
              value={formValues.matchDay}
              onChange={(changeEvent) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  matchDay: changeEvent.target.value,
                }))
              }
              className="rounded-none border-2 border-border"
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={isCreating}
              className="nb-btn rounded-none border-2 border-border bg-primary font-bold text-primary-foreground"
            >
              {isCreating ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </section>

      <section className="nb-card bg-card p-4">
        <h2 className="mb-3 text-xl font-black tracking-tight">Events</h2>

        <Table aria-label="Event management table">
          <TableHeader>
            <TableRow>
              <TableHead>Fixture</TableHead>
              <TableHead>Match Day</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvents.map((eventItem) => (
              <TableRow key={eventItem.id}>
                <TableCell className="font-semibold">
                  {eventItem.homeTeam} vs {eventItem.awayTeam}
                  <p className="font-mono text-xs text-muted-foreground">
                    {eventItem.venueName}, {eventItem.venueCity}
                  </p>
                </TableCell>
                <TableCell>{eventItem.matchDay}</TableCell>
                <TableCell className="font-mono text-xs">
                  {eventItem.startTime.toDate().toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusBadgeClass(eventItem.status)}>
                    {eventItem.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {eventItem.status === "upcoming" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          void handleStatusChange(eventItem, "live", {
                            analyticsEvent: "event_started",
                            successToast: "Event is now live.",
                          })
                        }
                        disabled={updatingEventId === eventItem.id}
                        className="nb-btn rounded-none border-2 border-border bg-primary px-2 py-1 text-xs font-bold text-primary-foreground"
                      >
                        Go Live
                      </Button>
                    ) : null}

                    {eventItem.status === "live" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleStatusChange(eventItem, "halftime", {
                            analyticsEvent: "event_halftime",
                            successToast: "Event moved to halftime.",
                            suggestionToast: "Consider launching a halftime challenge now",
                          })
                        }
                        disabled={updatingEventId === eventItem.id}
                        className="nb-btn rounded-none border-2 border-border bg-card px-2 py-1 text-xs font-bold"
                      >
                        Start Halftime
                      </Button>
                    ) : null}

                    {eventItem.status === "halftime" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleStatusChange(eventItem, "live", {
                            successToast: "Event resumed to live.",
                          })
                        }
                        disabled={updatingEventId === eventItem.id}
                        className="nb-btn rounded-none border-2 border-border bg-card px-2 py-1 text-xs font-bold"
                      >
                        Resume Live
                      </Button>
                    ) : null}

                    {(eventItem.status === "live" || eventItem.status === "halftime") ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEventToEnd(eventItem)}
                        disabled={updatingEventId === eventItem.id}
                        className="nb-btn rounded-none border-2 border-red-600 bg-white px-2 py-1 text-xs font-bold text-red-600"
                      >
                        End Event
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {loading ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">Loading events...</p>
        ) : null}
        {error ? (
          <p className="mt-3 font-mono text-xs text-destructive">{error}</p>
        ) : null}
      </section>

      <Dialog open={Boolean(eventToEnd)} onOpenChange={(open) => !open && setEventToEnd(null)}>
        <DialogContent className="rounded-none border-2 border-border bg-card p-5" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">End event now?</DialogTitle>
            <DialogDescription>
              This will mark the selected event as completed.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-2 border-border bg-card font-bold"
              onClick={() => setEventToEnd(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="nb-btn w-full rounded-none border-2 border-red-600 bg-white font-bold text-red-600"
              onClick={() => {
                if (!eventToEnd) {
                  return;
                }

                void handleStatusChange(eventToEnd, "completed", {
                  analyticsEvent: "event_ended",
                  successToast: "Event ended.",
                });
                setEventToEnd(null);
              }}
              disabled={Boolean(eventToEnd && updatingEventId === eventToEnd.id)}
            >
              End Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function AdminEventsPage() {
  return (
    <AuthGuard requireAdmin>
      <AdminEventsContent />
    </AuthGuard>
  );
}
