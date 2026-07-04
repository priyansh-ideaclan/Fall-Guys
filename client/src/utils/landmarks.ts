export interface LandmarkConfig {
  pos: [number, number, number];
  section: string;
}

export const LEVEL_1_LANDMARKS: LandmarkConfig[] = [
  { pos: [0.0, 0.4, -6.0], section: 'Spawn Grid' },                // LM 1
  { pos: [2.0, 0.4, -2.0], section: 'Spawn Exit Left' },          // LM 2
  { pos: [-2.0, 0.4, -2.0], section: 'Spawn Exit Right' },         // LM 3
  { pos: [0.0, 0.4, 2.5], section: 'Walkway 1 Entrance' },         // LM 4
  { pos: [0.0, 0.4, 6.0], section: 'Hurdle 1' },                  // LM 5
  { pos: [0.0, 0.4, 9.5], section: 'Walkway 1 Exit' },            // LM 6
  { pos: [0.0, 0.4, 13.0], section: 'Walkway 2' },                // LM 7
  { pos: [0.0, 0.4, 16.5], section: 'Walkway 2 Exit' },            // LM 8
  { pos: [0.0, 0.4, 20.0], section: 'Checkpoint 1' },             // LM 9
  { pos: [-1.5, 0.5, 23.0], section: 'Tilting Deck Start' },       // LM 10
  { pos: [-7.5, 0.5, 22.0], section: 'Left Path Mud' },            // LM 11
  { pos: [-7.5, 0.5, 27.0], section: 'Left Path Middle' },         // LM 12
  { pos: [-7.5, 0.5, 32.0], section: 'Left Path Exit' },           // LM 13
  { pos: [1.5, 0.5, 28.2], section: 'Middle Path Deck A' },        // LM 14
  { pos: [-1.2, 0.8, 31.8], section: 'Middle Path Deck B' },       // LM 15
  { pos: [1.2, 1.0, 35.4], section: 'Middle Path Deck C' },        // LM 16
  { pos: [-1.2, 1.2, 39.0], section: 'Middle Path Deck D' },       // LM 17
  { pos: [7.5, 0.5, 22.5], section: 'Right Path Moving Platform' },// LM 18
  { pos: [7.5, 0.8, 28.0], section: 'Right Path Speed Pad' },      // LM 19
  { pos: [7.5, 0.5, 34.0], section: 'Right Path Hammer' },         // LM 20
  { pos: [0.0, 1.0, 40.6], section: 'Checkpoint 2' },             // LM 21
  { pos: [0.0, 1.2, 44.5], section: 'Wind Blower Corridor' },     // LM 22
  { pos: [0.0, 1.05, 47.0], section: 'Jump Pad Launch' },         // LM 23
  { pos: [0.0, 7.5, 51.5], section: 'Sky Storey Ascent' },        // LM 24
  { pos: [0.0, 7.5, 54.0], section: 'Sky Storey High Deck' },      // LM 25
  { pos: [0.0, 8.3, 61.0], section: 'Windmill Crossing' },         // LM 26
  { pos: [0.0, 9.5, 65.5], section: 'Spinning Hammer Intro' },     // LM 27
  { pos: [0.0, 9.5, 69.5], section: 'Hammer Arena Center' },       // LM 28
  { pos: [0.0, 8.7, 76.5], section: 'Checkpoint 3' },             // LM 29
  { pos: [-5.0, 7.8, 81.0], section: 'Left Water Slide' },         // LM 30
  { pos: [0.0, 7.8, 81.0], section: 'Middle Rainbow Slide' },      // LM 31
  { pos: [5.0, 7.8, 81.0], section: 'Right Ice Slide' },           // LM 32
  { pos: [0.0, 4.5, 88.0], section: 'Slide Landing Sweeper' },    // LM 33
  { pos: [-8.5, 4.5, 88.0], section: 'Left Mud Trap' },            // LM 34
  { pos: [8.5, 4.5, 88.0], section: 'Right Mud Trap' },            // LM 35
  { pos: [3.5, 4.5, 94.0], section: 'Swinging Pendulum Hammer' },  // LM 36
  { pos: [0.0, 4.5, 100.0], section: 'Checkpoint 4' },            // LM 37
  { pos: [0.0, 4.5, 107.5], section: 'Sprint Road Center' },       // LM 38
  { pos: [0.0, 4.5, 114.5], section: 'Cannon Obstacle Section' },  // LM 39
  { pos: [0.0, 4.5, 119.0], section: 'Finish Trigger Sensor' }     // LM 40
];
