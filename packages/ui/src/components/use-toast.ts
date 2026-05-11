"use client";

import * as React from "react";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

export type ToastVariant = "default" | "destructive";

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type Action =
  | { type: "ADD_TOAST"; toast: ToastData }
  | { type: "DISMISS_TOAST"; toastId: string }
  | { type: "REMOVE_TOAST"; toastId: string };

interface State {
  toasts: ToastData[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "DISMISS_TOAST":
      if (!toastTimeouts.has(action.toastId)) {
        const t = setTimeout(() => {
          toastTimeouts.delete(action.toastId);
          dispatch({ type: "REMOVE_TOAST", toastId: action.toastId });
        }, TOAST_REMOVE_DELAY);
        toastTimeouts.set(action.toastId, t);
      }
      return state;
    case "REMOVE_TOAST":
      return { toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
}

let listeners: Array<(s: State) => void> = [];
let memoryState: State = { toasts: [] };
let count = 0;

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return String(count);
}

export function toast(opts: Omit<ToastData, "id">) {
  const id = genId();
  dispatch({ type: "ADD_TOAST", toast: { ...opts, id } });
  return {
    id,
    dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
  };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => { listeners = listeners.filter((l) => l !== setState); };
  }, []);
  return {
    toasts: state.toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: "DISMISS_TOAST", toastId: id }),
  };
}
