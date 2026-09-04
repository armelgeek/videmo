/**
 * Process de rendu, forke par la route d'export.
 *
 * Il ne connait ni Next ni HTTP : il recoit un projet deja forme, rend, et rend
 * compte sur IPC. Le tuer EST l'annulation — d'ou l'absence de tout etat a
 * nettoyer ici.
 *
 * JavaScript nu : un process forke ne sait pas charger de TypeScript.
 */
const { renderProjectToVideo } = require('./canvas-renderer');

process.on('message', async (msg) => {
  const { project, width, height, fps, outputPath } = msg || {};
  try {
    const res = await renderProjectToVideo(project, outputPath, {
      width, height, fps,
      onProgress: (value) => process.send?.({ type: 'progress', value }),
    });
    process.send?.({ type: 'done', path: res.outputPath, frames: res.frames });
    process.exit(0);
  } catch (err) {
    process.send?.({ type: 'error', message: (err && err.message) || String(err) });
    process.exit(1);
  }
});
