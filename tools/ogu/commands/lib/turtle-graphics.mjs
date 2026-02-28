/**
 * Turtle Graphics — Logo-style turtle for generating paths.
 */
export function createTurtle() {
  let x = 0, y = 0, angle = 0;
  const path = [{ x: 0, y: 0 }];

  function forward(distance) {
    const rad = (angle * Math.PI) / 180;
    x += distance * Math.cos(rad);
    y += distance * Math.sin(rad);
    path.push({ x, y });
  }

  function right(degrees) { angle -= degrees; }
  function left(degrees) { angle += degrees; }
  function getPosition() { return { x, y, angle }; }
  function getPath() { return [...path]; }

  return { forward, right, left, getPosition, getPath };
}
