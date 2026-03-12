const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', 
  },
  glowContainer: {
    position: 'absolute',
    // Shrunk the glow slightly so it wraps perfectly around the new smaller core
    width: '120%', 
    height: '120%',
    borderRadius: 999,
  },
  coreContainer: {
    // MAGIC FIX: 70% perfectly matches your old 'innerSize' math!
    width: '70%', 
    height: '70%', 
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  glassHighlight: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
});