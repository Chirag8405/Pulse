"use client";

import { useEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";

export function AxeMonitor() {
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!isDevelopment) {
      return;
    }

    let active = true;

    void import("@axe-core/react")
      .then(({ default: axe }) => {
        if (!active) {
          return;
        }

        void axe(React, ReactDOM, 1000);
      })
      .catch(() => {
        // Ignore axe startup errors in development-only monitor.
      });

    return () => {
      active = false;
    };
  }, [isDevelopment]);

  return null;
}
