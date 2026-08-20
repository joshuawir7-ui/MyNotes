# Instrucciones del Proyecto (Agent Instructions)

- **Commits y Pushes Automáticos:** Después de realizar correcciones o implementar nuevas funcionalidades y asegurarnos de que funcionan, **siempre** debo realizar `git add`, `git commit` y `git push` automáticamente hacia el repositorio de GitHub vinculado (la rama principal). El usuario confía en que los cambios se suban solos para que Vercel los despliegue.
- **Generación de APK:** Si se solicita, usar el script definido en el `package.json` (`npm run android:build`) para compilar la aplicación móvil y generar el archivo APK.
