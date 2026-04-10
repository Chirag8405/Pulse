"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Timestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VENUE_CITY, VENUE_NAME } from "@/constants";
import { useEventsFeed } from "@/hooks/useAdminRealtime";
import { logVenueAnalyticsEvent } from "@/lib/firebase/analytics";
import { eventDoc, eventsCollection } from "@/lib/firebase/collections";
import type { Event } from "@/types/firebase";

interface EventFormValues {
  title: string;
  homeTeam: string;
  awayTeam: string;
  startTimeInput: string;
}

const INITIAL_EVENT_FORM: EventFormValues = {
  title: "",
  homeTeam: "",
  awayTeam: "",
  startTimeInput: "",
};

function getStatusBadgeClass(status: Event["status"]): string {
  if (status === "live") {
    return "rounded-none border-2 border-border bg-red-600 px-2 py-1 text-xs font-bold text-white";
  }

  if (status === "halftime") {
    return "rounded-none border-2 border-border bg-amber-400 px-2 py-1 text-xs font-bold text-foreground";
  }

  if (status === "completed") {
    return "rounded-none border-2 border-border bg-emerald-600 px-2 py-1 text-xs font-bold text-white";
  }

  return "rounded-none border-2 border-border bg-muted px-2 py-1 text-xs font-bold text-foreground";
}

function AdminEventsContent() {
  const { data: events, loading, error } = useEventsFeed(60);

  const [formValues, setFormValues] = useState<EventFormValues>(INITIAL_EVENT_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (left, right) => right.startTime.toMillis() - left.startTime.toMillis()
    );
  }, [events]);

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !formValues.title.trim() ||
      !formValues.homeTeam.trim() ||
      !formValues.awayTeam.trim() ||
      !formValues.startTimeInput
    ) {
      toast.error("Please fill all event fields.");
      return;
    }

    const parsedStart = new Date(formValues.startTimeInput);

    if (Number.isNaN(parsedStart.getTime())) {
      toast.error("Start time is invalid.");
      return;
    }

    setIsCreating(true);

    try {
      const eventReference = doc(eventsCollection);
      const startTime = Timestamp.fromDate(parsedStart);

      const eventPayload: Event = {
        id: eventReference.id,
        title: formValues.title.trim(),
        venueName: VENUE_NAME,
        venueCity: VENUE_CITY,
        homeTeam: formValues.homeTeam.trim(),
        awayTeam: formValues.awayTeam.trim(),
        startTime,
        status: "upcoming",
        currentChallengeId: null,
        matchDay: parsedStart.toLocaleDateString(),
      };

      await setDoc(eventReference, eventPayload);
      toast.success("Event created.");
      setFormValues(INITIAL_EVENT_FORM);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Could not create event.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (
    eventItem: Event,
    nextStatus: Event["status"],
    analyticsEventName: "event_started" | "event_halftime" | "event_ended"
  ) => {
    setUpdatingEventId(eventItem.id);

    try {
      await updateDoc(eventDoc(eventItem.id), {
        status: nextStatus,
      });

      logVenueAnalyticsEvent(analyticsEventName, {
        eventId: eventItem.id,
        status: nextStatus,
      });

      toast.success(`Event status changed to ${nextStatus}.`);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Could not update event status.";
      toast.error(message);
    } finally {
      setUpdatingEventId(null);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Event Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule events and control match state transitions in realtime.
        </p>
      </header>

      <section className="nb-card bg-card p-5">
        <h2 className="text-xl font-black tracking-tight">Create Event</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateEvent}>
          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="event-title">
              Title
            </label>
            <Input
              id="event-title"
              value={formValues.title}
              onChange={(changeEvent) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  title: changeEvent.target.value,
                }))
              }
              className="rounded-none border-2 border-border"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="event-start">
              Start Time
            </label>
            <Input
              id="event-start"
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Fixture</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvents.map((eventItem) => (
              <TableRow key={eventItem.id}>
                <TableCell>
                  <p className="font-bold">{eventItem.title ?? "Untitled Event"}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {eventItem.venueName}, {eventItem.venueCity}
                  </p>
                </TableCell>
                <TableCell className="font-semibold">
                  {eventItem.homeTeam} vs {eventItem.awayTeam}
                </TableCell>
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
                          void handleStatusChange(eventItem, "live", "event_started")
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
                          void handleStatusChange(
                            eventItem,
                            "halftime",
                            "event_halftime"
                          )
                        }
                        disabled={updatingEventId === eventItem.id}
                        className="nb-btn rounded-none border-2 border-border bg-card px-2 py-1 text-xs font-bold"
                      >
                        Start Halftime
                      </Button>
                    ) : null}

                    {eventItem.status === "live" || eventItem.status === "halftime" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleStatusChange(eventItem, "completed", "event_ended")
                        }
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
