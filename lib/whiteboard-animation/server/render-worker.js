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

/**
 * process.send est ASYNCHRONE : sortir juste apres coupe avant que le message
 * parte. Un rendu long se terminait ainsi sans que son 'done' arrive jamais, et
 * le job restait fige sur sa derniere progression — observe a 88 % alors que la
 * video etait complete. On attend donc l'accuse d'envoi avant de sortir.
 */
function envoyerPuisSortir(message, code) {
  if (!process.send) {
    process.exit(code);
    return;
  }
  let sorti = false;
  const sortir = () => {
    if (sorti) return;
    sorti = true;
    process.exit(code);
  };
  // Le filet : si l'accuse n'arrive pas, on sort quand meme plutot que de
  // laisser un process suspendu indefiniment.
  const filet = setTimeout(sortir, 5000);
  filet.unref?.();
  process.send(message, () => {
    clearTimeout(filet);
    sortir();
  });
}

process.on('message', async (msg) => {
  const { project, width, height, fps, outputPath, watermark, brandLogoUrl } = msg || {};
  try {
    const res = await renderProjectToVideo(project, outputPath, {
      width, height, fps, watermark, brandLogoUrl,
      onProgress: (value) => process.send?.({ type: 'progress', value }),
    });
    envoyerPuisSortir({ type: 'done', path: res.outputPath, frames: res.frames }, 0);
  } catch (err) {
    envoyerPuisSortir({ type: 'error', message: (err && err.message) || String(err) }, 1);
  }
});
