import re

file_path = 'src/app/api/cron/send-reminders/route.ts'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Remove lines that contain 'source: cron_reminder'
    if 'source: cron_reminder' in line:
        continue
    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print(f'Removed source lines from {file_path}')
