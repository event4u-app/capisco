State indicator dot for sessions and processes. `running` softly pulses; `waiting` (needs broker approval) is a half-filled teal dot.

```jsx
<StatusDot status="running" />   {/* green, pulsing */}
<StatusDot status="idle" />      {/* hollow gray */}
<StatusDot status="waiting" />   {/* half-filled teal */}
```

Sizes default to 8px. Pulse uses the `capisco-pulse` keyframe (shipped in motion.css).
