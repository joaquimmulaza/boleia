#!/usr/bin/env perl
# Corrige ';' em falta em dumps Supabase para psql local (stdin → stdout; não altera repo).
use strict;
use warnings;

local $/;
my $sql = <>;

# pg_net indisponível em PG apt local
$sql =~ s/^\s*drop extension if exists "pg_net"\s*;?\s*\n//gim;
$sql =~ s/^\s*create extension if not exists "pg_net"[^\n]*\n//gim;

my @lines = split /\n/, $sql, -1;

sub next_significant {
  my ($i) = @_;
  for (my $j = $i + 1; $j < @lines; $j++) {
    return $lines[$j] if $lines[$j] !~ /^\s*$/;
  }
  return '';
}

for (my $i = 0; $i < @lines; $i++) {
  my $line = $lines[$i];
  next if $line =~ /;\s*$/;
  next if $line =~ /^\s*--/;
  next if $line =~ /^\s*$/;

  my $next = next_significant($i);
  my $needs =
    ($next eq '' && $line !~ /^\s*$/)
    || ($next =~ /^(create |alter |grant |revoke |set |SET |CREATE |ALTER |GRANT |REVOKE |insert into |INSERT INTO)/i);

  if ($needs) {
    $lines[$i] = $line . ';';
  }
}

print join("\n", @lines);
