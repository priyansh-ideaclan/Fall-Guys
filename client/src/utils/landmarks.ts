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
  { pos: [0.0, 1.0, 42.6], section: 'Checkpoint 2' },             // LM 21
  { pos: [0.0, 1.4, 44.5], section: 'Jump Pad Launch' },          // LM 22
  { pos: [0.0, 7.5, 52.0], section: 'Sky Storey Ascent' },        // LM 23
  { pos: [0.0, 7.5, 57.0], section: 'Sky Storey High Deck' },      // LM 24
  { pos: [-3.5, 8.3, 63.5], section: 'Sky Storey Ice Deck' },      // LM 25
  { pos: [3.5, 9.1, 68.0], section: 'Windmill Bridge Entrance' },  // LM 26
  { pos: [3.5, 9.1, 71.0], section: 'Windmill Bridge Exit' },      // LM 27
  { pos: [0.0, 10.7, 73.0], section: 'Checkpoint 3' },            // LM 28
  { pos: [-5.0, 7.8, 81.0], section: 'Left Water Slide' },         // LM 29
  { pos: [0.0, 7.8, 81.0], section: 'Middle Rainbow Slide' },      // LM 30
  { pos: [5.0, 7.8, 81.0], section: 'Right Ice Slide' },           // LM 31
  { pos: [0.0, 4.5, 88.0], section: 'Slide Landing Sweeper' },    // LM 32
  { pos: [-8.5, 4.5, 88.0], section: 'Left Mud Trap' },            // LM 33
  { pos: [8.5, 4.5, 88.0], section: 'Right Mud Trap' },            // LM 34
  { pos: [3.5, 4.5, 94.0], section: 'Swinging Pendulum Hammer' },  // LM 35
  { pos: [0.0, 4.5, 100.0], section: 'Checkpoint 4' },            // LM 36
  { pos: [0.0, 4.5, 105.0], section: 'Sprint Road Start' },        // LM 37
  { pos: [-3.0, 4.5, 109.0], section: 'Moving Barrier Gates' },     // LM 38
  { pos: [3.0, 4.5, 112.5], section: 'Balance Beam & Fan' },       // LM 39
  { pos: [0.0, 1.5, 120.0], section: 'Slanted Finish Ramp' },      // LM 40
  { pos: [0.0, -1.2, 128.0], section: 'Final Sweeper Hazard' },    // LM 41
  { pos: [0.0, -1.2, 135.0], section: 'Finish Trigger Sensor' }    // LM 42
];
